BEGIN;

ALTER TABLE "configuracoes_financeiras"
  ADD COLUMN "valorHoraAplicado" DECIMAL(10,2),
  ADD COLUMN "nivelAplicado" TEXT,
  ADD COLUMN "origemValorHora" TEXT NOT NULL DEFAULT 'VINCULO',
  ADD COLUMN "motivo" TEXT NOT NULL DEFAULT 'Nova vigência',
  ADD COLUMN "anteriorId" INTEGER,
  ADD COLUMN "criadoPorId" INTEGER,
  ADD COLUMN "encerradoPorId" INTEGER;

-- Preserva o valor que o sistema conhece hoje. Não reconstrói taxas passadas
-- que já possam ter sido sobrescritas. Não altera datas, benefícios ou vínculos.
UPDATE "configuracoes_financeiras" AS c
SET "valorHoraAplicado" = t."valorHora", "nivelAplicado" = t."nivel",
    "origemValorHora" = 'MIGRACAO_VALOR_ATUAL',
    "motivo" = 'Preservação do valor disponível na migração'
FROM "itens_tabela_remuneracao" AS t WHERE t.id = c."itemTabelaId";

ALTER TABLE "configuracoes_financeiras"
  ALTER COLUMN "valorHoraAplicado" SET NOT NULL,
  ALTER COLUMN "nivelAplicado" SET NOT NULL,
  ADD CONSTRAINT "financeiro_valor_hora_positivo" CHECK ("valorHoraAplicado" > 0),
  ADD CONSTRAINT "financeiro_periodo_valido" CHECK ("dataFim" IS NULL OR "dataFim" >= "dataInicio"),
  ADD CONSTRAINT "financeiro_anterior_fkey" FOREIGN KEY ("anteriorId") REFERENCES "configuracoes_financeiras"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "financeiro_autor_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "financeiro_encerrado_por_fkey" FOREIGN KEY ("encerradoPorId") REFERENCES "usuarios"(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX "configuracoes_financeiras_anteriorId_key" ON "configuracoes_financeiras"("anteriorId");
CREATE UNIQUE INDEX "financeiro_uma_vigencia_aberta" ON "configuracoes_financeiras"("colaboradorId") WHERE "dataFim" IS NULL;

-- Protege também contra uma edição acidental dos valores preservados pelo Studio.
-- Encerrar uma vigência é permitido; reabrir ou reescrever uma já encerrada, não.
CREATE FUNCTION proteger_historico_financeiro() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'O histórico financeiro não pode ser excluído. Encerre a vigência.';
  END IF;
  IF ROW(NEW.id, NEW."colaboradorId", NEW."itemTabelaId", NEW."beneficios", NEW."valorHoraAplicado",
         NEW."nivelAplicado", NEW."origemValorHora", NEW."motivo", NEW."dataInicio",
         NEW."anteriorId", NEW."criadoPorId", NEW."createdAt")
     IS DISTINCT FROM
     ROW(OLD.id, OLD."colaboradorId", OLD."itemTabelaId", OLD."beneficios", OLD."valorHoraAplicado",
         OLD."nivelAplicado", OLD."origemValorHora", OLD."motivo", OLD."dataInicio",
         OLD."anteriorId", OLD."criadoPorId", OLD."createdAt") THEN
    RAISE EXCEPTION 'A configuração financeira é histórica. Cadastre uma nova vigência.';
  END IF;
  IF OLD."dataFim" IS NOT NULL AND
     ROW(NEW."dataFim", NEW."encerradoPorId") IS DISTINCT FROM ROW(OLD."dataFim", OLD."encerradoPorId") THEN
    RAISE EXCEPTION 'Uma vigência financeira encerrada não pode ser reaberta ou alterada.';
  END IF;
  IF NEW."dataFim" IS NOT NULL AND OLD."dataFim" IS NULL AND EXISTS (
    SELECT 1 FROM "apontamentos_horas" a WHERE a."colaboradorId" = OLD."colaboradorId"
    AND a.data::date >= OLD."dataInicio"::date AND a.data::date > NEW."dataFim"::date
  ) THEN
    RAISE EXCEPTION 'O encerramento não pode retirar cobertura de horas já registradas.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financeiro_historico_imutavel" BEFORE UPDATE OR DELETE
ON "configuracoes_financeiras" FOR EACH ROW EXECUTE FUNCTION proteger_historico_financeiro();

COMMIT;
