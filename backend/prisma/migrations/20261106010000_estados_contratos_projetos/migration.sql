BEGIN;

-- Sem correspondência de negócio para os valores antigos. Nunca apagar ou
-- reclassificar projetos automaticamente durante migrate deploy.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "projetos" WHERE "tipoContrato"::text IN ('FIXO', 'HORAS', 'FECHADO') OR "status"::text = 'INATIVO') THEN
    RAISE EXCEPTION 'Projetos com classificações antigas: esta entrega exige recriar explicitamente o banco de demonstração autorizado e executar a seed atualizada. Não use reset em banco real.';
  END IF;
END $$;

CREATE TYPE "StatusProjeto" AS ENUM ('ATIVO', 'PAUSADO', 'ENCERRADO', 'CANCELADO');
ALTER TABLE "projetos" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projetos" ALTER COLUMN "status" TYPE "StatusProjeto" USING ("status"::text::"StatusProjeto");
ALTER TABLE "projetos" ALTER COLUMN "status" SET DEFAULT 'ATIVO';

ALTER TYPE "TipoContrato" RENAME TO "TipoContrato_anterior";
CREATE TYPE "TipoContrato" AS ENUM ('FEE_MENSAL', 'ESCOPO_SEMIABERTO', 'SQUAD');
ALTER TABLE "projetos" ALTER COLUMN "tipoContrato" TYPE "TipoContrato" USING ("tipoContrato"::text::"TipoContrato");
DROP TYPE "TipoContrato_anterior";

COMMIT;
