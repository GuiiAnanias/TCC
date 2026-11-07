-- Referências das fotografias de premiação precisam de integridade referencial,
-- inclusive quando o projeto ainda não tem equipe, tarefas ou apontamentos.
BEGIN;
CREATE TABLE "projetos_avaliacoes" (
  "projetoId" INTEGER NOT NULL REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "avaliacaoId" INTEGER NOT NULL REFERENCES "avaliacoes_premiacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("projetoId", "avaliacaoId")
);
CREATE INDEX "projetos_avaliacoes_avaliacaoId_idx" ON "projetos_avaliacoes"("avaliacaoId");

CREATE FUNCTION preservar_projetos_avaliacao() RETURNS trigger AS $$
BEGIN
  INSERT INTO projetos_avaliacoes ("projetoId", "avaliacaoId")
  SELECT DISTINCT id, NEW.id FROM (
    SELECT value::integer AS id
    FROM jsonb_array_elements_text(COALESCE(NEW.conteudo #> '{dados,projetoIds}', '[]'::jsonb))
    UNION
    SELECT (value->>'id')::integer AS id
    FROM jsonb_array_elements(COALESCE(NEW.conteudo #> '{base,projetos}', '[]'::jsonb))
  ) AS referencias
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER preservar_projetos_avaliacao
AFTER INSERT OR UPDATE OF conteudo ON avaliacoes_premiacao
FOR EACH ROW EXECUTE FUNCTION preservar_projetos_avaliacao();

-- Não altera o conteúdo das avaliações existentes. Referências inválidas fazem
-- a migração falhar, em vez de apagar registros ou silenciar perda de histórico.
INSERT INTO projetos_avaliacoes ("projetoId", "avaliacaoId")
SELECT DISTINCT referencias.id, a.id
FROM avaliacoes_premiacao a
CROSS JOIN LATERAL (
  SELECT value::integer AS id
  FROM jsonb_array_elements_text(COALESCE(a.conteudo #> '{dados,projetoIds}', '[]'::jsonb))
  UNION
  SELECT (value->>'id')::integer AS id
  FROM jsonb_array_elements(COALESCE(a.conteudo #> '{base,projetos}', '[]'::jsonb))
) AS referencias
ON CONFLICT DO NOTHING;
COMMIT;
