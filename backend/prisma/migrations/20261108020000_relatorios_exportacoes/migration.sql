-- Histórico de relatórios: registra cada download de PDF ou Excel de uma fotografia.
-- O arquivo não é guardado; o conteúdo histórico é a própria fotografia, já imutável.
BEGIN;
CREATE TABLE "relatorios_exportacoes" (
  "id" SERIAL NOT NULL,
  "relatorioId" INTEGER NOT NULL,
  "formato" TEXT NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "relatorios_exportacoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "relatorios_exportacoes_formato_check" CHECK ("formato" IN ('PDF', 'XLSX'))
);
CREATE INDEX "relatorios_exportacoes_relatorioId_idx" ON "relatorios_exportacoes"("relatorioId");
ALTER TABLE "relatorios_exportacoes" ADD CONSTRAINT "relatorios_exportacoes_relatorioId_fkey"
  FOREIGN KEY ("relatorioId") REFERENCES "relatorios_gerados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "relatorios_exportacoes" ADD CONSTRAINT "relatorios_exportacoes_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "relatorios_gerados_criadoPorId_idx" ON "relatorios_gerados"("criadoPorId");

-- O registro de downloads é histórico: não é alterado nem excluído, inclusive por fora da API.
CREATE FUNCTION proteger_exportacao_relatorio() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CODEBI_EXPORTACAO_IMUTAVEL: o registro de downloads de um relatório não pode ser alterado nem excluído';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER proteger_exportacao_relatorio
BEFORE UPDATE OR DELETE ON relatorios_exportacoes
FOR EACH ROW EXECUTE FUNCTION proteger_exportacao_relatorio();
COMMIT;
