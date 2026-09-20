/*
  Warnings:

  - The values [PENDENTE,APROVADO,FATURADO] on the enum `StatusApontamento` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusApontamento_new" AS ENUM ('Pendente', 'Aprovado', 'Faturado');
ALTER TABLE "public"."apontamentos_horas" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "apontamentos_horas" ALTER COLUMN "status" TYPE "StatusApontamento_new" USING ("status"::text::"StatusApontamento_new");
ALTER TYPE "StatusApontamento" RENAME TO "StatusApontamento_old";
ALTER TYPE "StatusApontamento_new" RENAME TO "StatusApontamento";
DROP TYPE "public"."StatusApontamento_old";
ALTER TABLE "apontamentos_horas" ALTER COLUMN "status" SET DEFAULT 'Pendente';
COMMIT;

-- AlterTable
ALTER TABLE "apontamentos_horas" ALTER COLUMN "status" SET DEFAULT 'Pendente';
