-- Histórico de importações de apontamentos: uma linha por tentativa de importar uma
-- planilha, concluída ou com falha. O arquivo não é guardado; projetos e erros ficam
-- como cópia em JSON do que foi conferido no momento.
BEGIN;
CREATE TABLE "importacoes_apontamentos" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "arquivo" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "mensagem" TEXT,
  "linhas" INTEGER NOT NULL DEFAULT 0,
  "importados" INTEGER NOT NULL DEFAULT 0,
  "comErro" INTEGER NOT NULL DEFAULT 0,
  "horas" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "periodoInicio" DATE,
  "periodoFim" DATE,
  "projetos" JSONB NOT NULL DEFAULT '[]',
  "erros" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "importacoes_apontamentos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "importacoes_apontamentos_status_check" CHECK ("status" IN ('CONCLUIDA', 'FALHOU')),
  CONSTRAINT "importacoes_apontamentos_contagens_check" CHECK (
    "linhas" >= 0 AND "importados" >= 0 AND "comErro" >= 0 AND "horas" >= 0
  )
);
CREATE INDEX "importacoes_apontamentos_createdAt_idx" ON "importacoes_apontamentos"("createdAt");
ALTER TABLE "importacoes_apontamentos" ADD CONSTRAINT "importacoes_apontamentos_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- O histórico não é alterado nem excluído, inclusive por fora da API.
CREATE FUNCTION proteger_historico_importacao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CODEBI_IMPORTACAO_IMUTAVEL: o histórico de importações não pode ser alterado nem excluído';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER proteger_historico_importacao
BEFORE UPDATE OR DELETE ON importacoes_apontamentos
FOR EACH ROW EXECUTE FUNCTION proteger_historico_importacao();
COMMIT;
