BEGIN;

-- Tipos de contrato genéricos para empresas de software: Escopo fechado, Por hora,
-- Fee mensal e Squad. "Escopo semiaberto" era uma classificação específica de uma
-- empresa; os projetos que a usavam passam a Escopo fechado. Os bancos do projeto são
-- de demonstração; em uma base real, revisar a classificação desses projetos depois.
ALTER TYPE "TipoContrato" RENAME TO "TipoContrato_anterior";
CREATE TYPE "TipoContrato" AS ENUM ('ESCOPO_FECHADO', 'POR_HORA', 'FEE_MENSAL', 'SQUAD');
ALTER TABLE "projetos" ALTER COLUMN "tipoContrato" TYPE "TipoContrato" USING (
  CASE "tipoContrato"::text
    WHEN 'ESCOPO_SEMIABERTO' THEN 'ESCOPO_FECHADO'
    ELSE "tipoContrato"::text
  END
)::"TipoContrato";
DROP TYPE "TipoContrato_anterior";

COMMIT;
