-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "apontamentos_horas" ADD COLUMN     "tarefaId" INTEGER;

-- CreateTable
CREATE TABLE "sprints" (
    "id" SERIAL NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "dataInicio" DATE,
    "dataFim" DATE,
    "statusRegistro" "Status" NOT NULL DEFAULT 'ATIVO',
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" SERIAL NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "sprintId" INTEGER,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusTarefa" NOT NULL DEFAULT 'PLANEJADA',
    "statusOrigem" TEXT,
    "minutosEstimados" INTEGER,
    "correcao" BOOLEAN NOT NULL DEFAULT false,
    "dataInicio" DATE,
    "dataConclusao" DATE,
    "statusRegistro" "Status" NOT NULL DEFAULT 'ATIVO',
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas_responsaveis" (
    "tarefaId" INTEGER NOT NULL,
    "colaboradorId" INTEGER NOT NULL,

    CONSTRAINT "tarefas_responsaveis_pkey" PRIMARY KEY ("tarefaId","colaboradorId")
);

-- CreateIndex
CREATE INDEX "sprints_projetoId_statusRegistro_idx" ON "sprints"("projetoId", "statusRegistro");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_id_projetoId_key" ON "sprints"("id", "projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_projetoId_origem_externalId_key" ON "sprints"("projetoId", "origem", "externalId");

-- CreateIndex
CREATE INDEX "tarefas_projetoId_statusRegistro_status_idx" ON "tarefas"("projetoId", "statusRegistro", "status");

-- CreateIndex
CREATE INDEX "tarefas_sprintId_projetoId_idx" ON "tarefas"("sprintId", "projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "tarefas_id_projetoId_key" ON "tarefas"("id", "projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "tarefas_projetoId_origem_externalId_key" ON "tarefas"("projetoId", "origem", "externalId");

-- CreateIndex
CREATE INDEX "tarefas_responsaveis_colaboradorId_idx" ON "tarefas_responsaveis"("colaboradorId");

-- CreateIndex
CREATE INDEX "apontamentos_horas_tarefaId_projetoId_idx" ON "apontamentos_horas"("tarefaId", "projetoId");

-- AddForeignKey
ALTER TABLE "apontamentos_horas" ADD CONSTRAINT "apontamentos_horas_tarefaId_projetoId_fkey" FOREIGN KEY ("tarefaId", "projetoId") REFERENCES "tarefas"("id", "projetoId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_sprintId_projetoId_fkey" FOREIGN KEY ("sprintId", "projetoId") REFERENCES "sprints"("id", "projetoId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tarefas_responsaveis" ADD CONSTRAINT "tarefas_responsaveis_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_responsaveis" ADD CONSTRAINT "tarefas_responsaveis_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restrições também protegem inserções externas à aplicação.
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_periodo_check" CHECK ("dataInicio" IS NULL OR "dataFim" IS NULL OR "dataFim" >= "dataInicio");
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_estimativa_check" CHECK ("minutosEstimados" IS NULL OR "minutosEstimados" BETWEEN 1 AND 6000000);
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_periodo_check" CHECK ("dataInicio" IS NULL OR "dataConclusao" IS NULL OR "dataConclusao" >= "dataInicio");
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_conclusao_check" CHECK ("dataConclusao" IS NULL OR "status" = 'CONCLUIDA');

