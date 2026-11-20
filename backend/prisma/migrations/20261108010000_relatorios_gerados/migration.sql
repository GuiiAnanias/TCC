-- Fotografias dos relatórios gerados. A prévia e as exportações leem a cópia gravada,
-- sem mudar quando os dados de origem mudam depois.
BEGIN;
CREATE TABLE "relatorios_gerados" (
  "id" SERIAL NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "filtros" JSONB NOT NULL,
  "blocos" TEXT[],
  "conteudo" JSONB NOT NULL,
  "criadoPorId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "relatorios_gerados_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "relatorios_gerados_blocos_check" CHECK (cardinality("blocos") > 0)
);
CREATE INDEX "relatorios_gerados_createdAt_idx" ON "relatorios_gerados"("createdAt");
ALTER TABLE "relatorios_gerados" ADD CONSTRAINT "relatorios_gerados_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "relatorios_projetos" (
  "projetoId" INTEGER NOT NULL,
  "relatorioId" INTEGER NOT NULL,
  CONSTRAINT "relatorios_projetos_pkey" PRIMARY KEY ("projetoId", "relatorioId")
);
CREATE INDEX "relatorios_projetos_relatorioId_idx" ON "relatorios_projetos"("relatorioId");
ALTER TABLE "relatorios_projetos" ADD CONSTRAINT "relatorios_projetos_projetoId_fkey"
  FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "relatorios_projetos" ADD CONSTRAINT "relatorios_projetos_relatorioId_fkey"
  FOREIGN KEY ("relatorioId") REFERENCES "relatorios_gerados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Os projetos da fotografia ficam registrados pelo banco, inclusive em escritas diretas,
-- e impedem a exclusão definitiva desses projetos.
CREATE FUNCTION registrar_projetos_relatorio() RETURNS trigger AS $$
BEGIN
  INSERT INTO relatorios_projetos ("projetoId", "relatorioId")
  SELECT DISTINCT (value->>'id')::integer, NEW.id
  FROM jsonb_array_elements(COALESCE(NEW.conteudo->'projetos', '[]'::jsonb))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER registrar_projetos_relatorio
AFTER INSERT ON relatorios_gerados
FOR EACH ROW EXECUTE FUNCTION registrar_projetos_relatorio();

CREATE FUNCTION proteger_relatorio_gerado() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CODEBI_RELATORIO_IMUTAVEL: a fotografia de um relatório gerado não pode ser alterada nem excluída';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER proteger_relatorio_gerado
BEFORE UPDATE OR DELETE ON relatorios_gerados
FOR EACH ROW EXECUTE FUNCTION proteger_relatorio_gerado();
CREATE TRIGGER proteger_projetos_relatorio
BEFORE UPDATE OR DELETE ON relatorios_projetos
FOR EACH ROW EXECUTE FUNCTION proteger_relatorio_gerado();
COMMIT;
