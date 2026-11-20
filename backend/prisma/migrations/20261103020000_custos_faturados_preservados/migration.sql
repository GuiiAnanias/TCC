BEGIN;
LOCK TABLE "apontamentos_horas", "projetos_colaboradores", "bonificacoes_papeis", "configuracoes_financeiras" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "apontamentos_horas"
 ADD COLUMN "custoConsolidado" JSONB,
 ADD COLUMN "historicoCustos" JSONB NOT NULL DEFAULT '[]';

-- Mesmo critério diário e arredondamento usados pelo dashboard. Sem inventar
-- parâmetros desconhecidos: pendências antigas ficam identificadas na composição.
CREATE FUNCTION calcular_custo_apontamento(pessoa INTEGER, projeto INTEGER, dia DATE, quantidade NUMERIC)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
 config RECORD; membro RECORD; bonus RECORD;
 configuracoes INTEGER; membros INTEGER; regras INTEGER;
 taxa NUMERIC; percentual NUMERIC := 0; base NUMERIC; adicional NUMERIC;
 pendencia TEXT;
BEGIN
 SELECT count(*) INTO configuracoes FROM "configuracoes_financeiras" c
 WHERE c."colaboradorId" = pessoa AND c."dataInicio"::date <= dia
 AND (c."dataFim" IS NULL OR c."dataFim"::date >= dia);
 SELECT * INTO config FROM "configuracoes_financeiras" c
 WHERE c."colaboradorId" = pessoa AND c."dataInicio"::date <= dia
 AND (c."dataFim" IS NULL OR c."dataFim"::date >= dia)
 ORDER BY c."dataInicio" DESC, c.id DESC LIMIT 1;
 SELECT count(*) INTO membros FROM "projetos_colaboradores" e
 WHERE e."colaboradorId" = pessoa AND e."projetoId" = projeto AND e."dataEntrada"::date <= dia
 AND (e."dataSaida" IS NULL OR e."dataSaida"::date >= dia);
 SELECT * INTO membro FROM "projetos_colaboradores" e
 WHERE e."colaboradorId" = pessoa AND e."projetoId" = projeto AND e."dataEntrada"::date <= dia
 AND (e."dataSaida" IS NULL OR e."dataSaida"::date >= dia)
 ORDER BY e."dataEntrada" DESC, e.id DESC LIMIT 1;
 SELECT count(*) INTO regras FROM "bonificacoes_papeis" b
 WHERE b.papel = membro.papel AND b."dataInicio" <= dia AND (b."dataFim" IS NULL OR b."dataFim" > dia);
 SELECT * INTO bonus FROM "bonificacoes_papeis" b
 WHERE b.papel = membro.papel AND b."dataInicio" <= dia AND (b."dataFim" IS NULL OR b."dataFim" > dia)
 ORDER BY b."dataInicio" DESC, b.id DESC LIMIT 1;
 taxa := config."valorHoraAplicado";
 percentual := COALESCE(bonus.percentual, 0);
 base := round(COALESCE(taxa, 0) * quantidade, 2);
 adicional := round(COALESCE(taxa, 0) * quantidade * percentual / 100, 2);
 IF configuracoes = 0 THEN pendencia := 'Valor/hora ausente';
 ELSIF configuracoes > 1 THEN pendencia := 'Vigências financeiras ambíguas';
 ELSIF membros = 0 THEN pendencia := 'Participação de equipe ausente';
 ELSIF membros > 1 THEN pendencia := 'Participações de equipe ambíguas';
 ELSIF regras > 1 THEN pendencia := 'Bonificação com vigências ambíguas'; END IF;
 RETURN jsonb_build_object(
  'valorHora', taxa, 'nivel', config."nivelAplicado", 'papel', membro.papel,
  'percentual', percentual, 'custoBase', base, 'bonificacao', adicional, 'custo', base + adicional,
  'semCusto', configuracoes <> 1, 'semVinculo', membros <> 1, 'pendencia', pendencia,
  'configuracaoId', config.id, 'participacaoId', membro.id, 'bonificacaoId', bonus.id);
END $$;

-- Registros ambíguos exigem revisão; a transação inteira é desfeita, sem escolher
-- arbitrariamente uma versão para consolidar.
DO $$
DECLARE conflitos TEXT;
BEGIN
 SELECT string_agg(a.id::text, ', ') INTO conflitos FROM "apontamentos_horas" a
 WHERE a.status = 'FATURADO' AND calcular_custo_apontamento(a."colaboradorId", a."projetoId", a.data, a.horas)->>'pendencia' LIKE '%ambígu%';
 IF conflitos IS NOT NULL THEN RAISE EXCEPTION 'Custos ambíguos; revisar os apontamentos antes de migrar: %', conflitos; END IF;
END $$;

-- Preserva somente os valores disponíveis agora, sem afirmar reconstrução de
-- valores anteriores. Até registros incompletos conservam a indicação de pendência.
UPDATE "apontamentos_horas" a SET "custoConsolidado" =
 calcular_custo_apontamento(a."colaboradorId", a."projetoId", a.data, a.horas) ||
 jsonb_build_object('origem', 'MIGRACAO_VALOR_ATUAL', 'versao', 1, 'consolidadoEm', CURRENT_TIMESTAMP)
WHERE a.status = 'FATURADO';
UPDATE "apontamentos_horas" SET "historicoCustos" = jsonb_build_array("custoConsolidado")
WHERE "custoConsolidado" IS NOT NULL;

-- Os fluxos manuais, importações e alterações de parâmetros compartilham a trava.
-- Nos serviços, transações serializáveis com retry também protegem leituras anteriores.
CREATE FUNCTION bloquear_apuracao_custo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(1129270597, 3);
 RETURN NULL;
END $$;
CREATE TRIGGER custo_trava_horas BEFORE INSERT OR UPDATE OR DELETE ON "apontamentos_horas"
 FOR EACH STATEMENT EXECUTE FUNCTION bloquear_apuracao_custo();
CREATE TRIGGER custo_trava_equipe BEFORE INSERT OR UPDATE OR DELETE ON "projetos_colaboradores"
 FOR EACH STATEMENT EXECUTE FUNCTION bloquear_apuracao_custo();
CREATE TRIGGER custo_trava_bonus BEFORE INSERT OR UPDATE OR DELETE ON "bonificacoes_papeis"
 FOR EACH STATEMENT EXECUTE FUNCTION bloquear_apuracao_custo();
CREATE TRIGGER custo_trava_financeiro BEFORE INSERT OR UPDATE OR DELETE ON "configuracoes_financeiras"
 FOR EACH STATEMENT EXECUTE FUNCTION bloquear_apuracao_custo();

CREATE FUNCTION consolidar_custo_faturado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE composicao JSONB; versao INTEGER;
BEGIN
 IF TG_OP = 'DELETE' THEN
  IF OLD.status = 'FATURADO' THEN RAISE EXCEPTION 'CODEBI_CUSTO_TRAVADO: volte para Aprovado antes de excluir'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW."historicoCustos" IS DISTINCT FROM OLD."historicoCustos"
   OR NEW."custoConsolidado" IS DISTINCT FROM OLD."custoConsolidado" THEN
   RAISE EXCEPTION 'CODEBI_CUSTO_TRAVADO: composição preservada não pode ser sobrescrita';
  END IF;
  IF OLD.status = 'FATURADO' THEN
   IF ROW(NEW."colaboradorId", NEW."projetoId", NEW."tarefaId", NEW.data, NEW.horas, NEW.descricao)
      IS DISTINCT FROM ROW(OLD."colaboradorId", OLD."projetoId", OLD."tarefaId", OLD.data, OLD.horas, OLD.descricao) THEN
    RAISE EXCEPTION 'CODEBI_CUSTO_TRAVADO: volte para Aprovado antes de corrigir';
   END IF;
   IF NEW.status = 'FATURADO' THEN RETURN NEW; END IF;
   NEW."custoConsolidado" := NULL;
   RETURN NEW;
  END IF;
 ELSE
  IF NEW."custoConsolidado" IS NOT NULL OR NEW."historicoCustos" <> '[]'::jsonb THEN
   RAISE EXCEPTION 'CODEBI_CUSTO_TRAVADO: composição deve ser apurada pelo banco';
  END IF;
 END IF;
 IF NEW.status = 'FATURADO' THEN
  composicao := calcular_custo_apontamento(NEW."colaboradorId", NEW."projetoId", NEW.data, NEW.horas);
  IF composicao->>'pendencia' IS NOT NULL THEN
   RAISE EXCEPTION 'CODEBI_CUSTO_PENDENTE: %', composicao->>'pendencia';
  END IF;
  versao := jsonb_array_length(NEW."historicoCustos") + 1;
  NEW."custoConsolidado" := composicao || jsonb_build_object('origem', 'FATURAMENTO', 'versao', versao, 'consolidadoEm', clock_timestamp());
  NEW."historicoCustos" := NEW."historicoCustos" || jsonb_build_array(NEW."custoConsolidado");
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custo_consolidar BEFORE INSERT OR UPDATE OR DELETE ON "apontamentos_horas"
 FOR EACH ROW EXECUTE FUNCTION consolidar_custo_faturado();

-- Alterações retroativas que reinterpretariam uma consolidação exigem antes
-- a correção explícita dos apontamentos (Faturado -> Aprovado -> Faturado).
CREATE FUNCTION proteger_parametros_faturados() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE registro RECORD; atual JSONB; assinatura TEXT[] := ARRAY[
 'valorHora','nivel','papel','percentual','custoBase','bonificacao','custo','semCusto','semVinculo'];
 chave TEXT;
BEGIN
 FOR registro IN SELECT a.* FROM "apontamentos_horas" a
 WHERE a.status = 'FATURADO' AND a."custoConsolidado"->>'pendencia' IS NULL
 LOOP
  atual := calcular_custo_apontamento(registro."colaboradorId", registro."projetoId", registro.data, registro.horas);
  FOREACH chave IN ARRAY assinatura LOOP
   IF atual->chave IS DISTINCT FROM registro."custoConsolidado"->chave THEN
    RAISE EXCEPTION 'CODEBI_CUSTO_RETROATIVO: alteração afeta o apontamento faturado %', registro.id;
   END IF;
  END LOOP;
 END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER custo_proteger_equipe AFTER INSERT OR UPDATE OR DELETE ON "projetos_colaboradores"
 FOR EACH STATEMENT EXECUTE FUNCTION proteger_parametros_faturados();
CREATE TRIGGER custo_proteger_bonus AFTER INSERT OR UPDATE OR DELETE ON "bonificacoes_papeis"
 FOR EACH STATEMENT EXECUTE FUNCTION proteger_parametros_faturados();
CREATE TRIGGER custo_proteger_financeiro AFTER INSERT OR UPDATE OR DELETE ON "configuracoes_financeiras"
 FOR EACH STATEMENT EXECUTE FUNCTION proteger_parametros_faturados();
COMMIT;
