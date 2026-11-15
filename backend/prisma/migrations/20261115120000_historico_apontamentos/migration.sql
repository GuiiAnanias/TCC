-- CreateTable
CREATE TABLE "historico_apontamentos" (
    "id" SERIAL NOT NULL,
    "apontamentoId" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "colaboradorNome" TEXT NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "projetoNome" TEXT NOT NULL,
    "tarefaId" INTEGER,
    "tarefaTitulo" TEXT,
    "data" DATE NOT NULL,
    "horas" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dadosAnteriores" JSONB NOT NULL,
    "dadosNovos" JSONB,
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_apontamentos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "historico_apontamentos_situacao_check" CHECK ("situacao" IN ('MODIFICADO', 'EXCLUIDO'))
);

-- CreateIndex
CREATE INDEX "historico_apontamentos_situacao_createdAt_idx" ON "historico_apontamentos"("situacao", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "historico_apontamentos_apontamentoId_idx" ON "historico_apontamentos"("apontamentoId");

-- CreateIndex
CREATE INDEX "historico_apontamentos_colaboradorId_idx" ON "historico_apontamentos"("colaboradorId");

-- CreateIndex
CREATE INDEX "historico_apontamentos_projetoId_idx" ON "historico_apontamentos"("projetoId");

-- AddForeignKey
ALTER TABLE "historico_apontamentos" ADD CONSTRAINT "historico_apontamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Imutabilidade do histórico de apontamentos
CREATE OR REPLACE FUNCTION proteger_historico_apontamento()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de apontamentos é imutável e não pode ser alterado ou excluído.'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historico_apontamentos_imutavel
BEFORE UPDATE OR DELETE ON "historico_apontamentos"
FOR EACH ROW EXECUTE FUNCTION proteger_historico_apontamento();
