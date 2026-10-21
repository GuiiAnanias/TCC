CREATE TABLE "regras_premiacao" (
  "id" SERIAL PRIMARY KEY, "nome" TEXT NOT NULL, "categoria" TEXT NOT NULL CHECK ("categoria" IN ('DEV','PO_SM')),
  "definicao" JSONB NOT NULL, "criadoPorId" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "avaliacoes_premiacao" (
  "id" SERIAL PRIMARY KEY, "colaboradorId" INTEGER NOT NULL REFERENCES "colaboradores"("id") ON DELETE RESTRICT,
  "competencia" TEXT NOT NULL CHECK ("competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  "categoria" TEXT NOT NULL CHECK ("categoria" IN ('DEV','PO_SM')), "versao" INTEGER NOT NULL DEFAULT 1 CHECK ("versao" > 0),
  "revisao" INTEGER NOT NULL DEFAULT 1 CHECK ("revisao" > 0), "status" TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK ("status" IN ('RASCUNHO','CONCLUIDA')),
  "regraId" INTEGER NOT NULL REFERENCES "regras_premiacao"("id") ON DELETE RESTRICT,
  "conteudo" JSONB NOT NULL, "criadoPorId" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "concluidoPorId" INTEGER REFERENCES "usuarios"("id") ON DELETE RESTRICT, "concluidoEm" TIMESTAMP(3),
  "anteriorId" INTEGER UNIQUE REFERENCES "avaliacoes_premiacao"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("colaboradorId", "competencia", "categoria", "versao"),
  CHECK (("status" = 'CONCLUIDA' AND "concluidoEm" IS NOT NULL AND "concluidoPorId" IS NOT NULL) OR ("status" = 'RASCUNHO' AND "concluidoEm" IS NULL AND "concluidoPorId" IS NULL))
);
CREATE FUNCTION proteger_regra_premiacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Regras publicadas são imutáveis. Crie outra versão.'; END $$;
CREATE TRIGGER regra_premiacao_imutavel BEFORE UPDATE OR DELETE ON "regras_premiacao" FOR EACH ROW EXECUTE FUNCTION proteger_regra_premiacao();
CREATE FUNCTION proteger_avaliacao_premiacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" = 'CONCLUIDA' THEN
    RAISE EXCEPTION 'Avaliações concluídas e históricos devem ser preservados. Crie uma reavaliação.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER avaliacao_premiacao_historico BEFORE UPDATE OR DELETE ON "avaliacoes_premiacao" FOR EACH ROW EXECUTE FUNCTION proteger_avaliacao_premiacao();
