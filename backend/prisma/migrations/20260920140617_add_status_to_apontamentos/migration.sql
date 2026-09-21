-- CreateEnum
CREATE TYPE "StatusApontamento" AS ENUM ('PENDENTE', 'APROVADO', 'FATURADO');

-- AlterTable
ALTER TABLE "apontamentos_horas" ADD COLUMN     "status" "StatusApontamento" NOT NULL DEFAULT 'PENDENTE';
