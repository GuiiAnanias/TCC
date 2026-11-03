BEGIN;
LOCK TABLE "projetos_colaboradores" IN ACCESS EXCLUSIVE MODE;
-- O cálculo anterior já atribuía o dia de transição ao vínculo mais recente.
-- Só normalizar a fronteira de papéis diferentes, sem apagar participações.
UPDATE "projetos_colaboradores" a SET "dataSaida" = a."dataSaida"::date - INTERVAL '1 day'
WHERE a."dataSaida"::date > a."dataEntrada"::date
AND EXISTS (SELECT 1 FROM "projetos_colaboradores" b WHERE b.id <> a.id
 AND b."projetoId" = a."projetoId" AND b."colaboradorId" = a."colaboradorId"
 AND b.papel <> a.papel AND b."dataEntrada"::date = a."dataSaida"::date);
DO $$
DECLARE conflitos TEXT;
BEGIN
 SELECT string_agg(a.id || '/' || b.id, ', ') INTO conflitos
 FROM "projetos_colaboradores" a JOIN "projetos_colaboradores" b ON a.id < b.id
 AND a."projetoId" = b."projetoId" AND a."colaboradorId" = b."colaboradorId"
 AND a."dataEntrada"::date <= COALESCE(b."dataSaida"::date, 'infinity'::date)
 AND b."dataEntrada"::date <= COALESCE(a."dataSaida"::date, 'infinity'::date);
 IF conflitos IS NOT NULL THEN
   RAISE EXCEPTION 'Participações conflitantes; revisar os pares de IDs antes de migrar: %', conflitos;
 END IF;
END $$;
ALTER TABLE "projetos_colaboradores"
 ADD CONSTRAINT "equipe_periodo_valido" CHECK ("dataSaida" IS NULL OR "dataSaida"::date >= "dataEntrada"::date),
 -- Faixas unitárias de IDs permitem GiST sem instalar extensões no servidor.
 ADD CONSTRAINT "equipe_periodos_sem_sobreposicao" EXCLUDE USING gist (
   int4range("projetoId", "projetoId", '[]') WITH &&,
   int4range("colaboradorId", "colaboradorId", '[]') WITH &&,
   daterange("dataEntrada"::date, "dataSaida"::date, '[]') WITH &&
 );
CREATE UNIQUE INDEX "equipe_um_vinculo_aberto" ON "projetos_colaboradores" ("projetoId", "colaboradorId") WHERE "dataSaida" IS NULL;
COMMIT;
