-- CreateTable
CREATE TABLE "apontamentos_horas" (
    "id" SERIAL NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "horas" DECIMAL(5,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apontamentos_horas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apontamentos_horas_colaboradorId_idx" ON "apontamentos_horas"("colaboradorId");

-- CreateIndex
CREATE INDEX "apontamentos_horas_projetoId_idx" ON "apontamentos_horas"("projetoId");

-- AddForeignKey
ALTER TABLE "apontamentos_horas" ADD CONSTRAINT "apontamentos_horas_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamentos_horas" ADD CONSTRAINT "apontamentos_horas_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
