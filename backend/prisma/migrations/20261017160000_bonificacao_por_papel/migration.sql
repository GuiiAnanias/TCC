CREATE TABLE "bonificacoes_papeis" (
  "id" SERIAL NOT NULL,
  "papel" TEXT NOT NULL,
  "percentual" DECIMAL(10,2) NOT NULL,
  "dataInicio" DATE NOT NULL,
  "dataFim" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bonificacoes_papeis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bonificacoes_papeis_percentual_check" CHECK ("percentual" >= 0),
  CONSTRAINT "bonificacoes_papeis_periodo_check" CHECK ("dataFim" IS NULL OR "dataFim" > "dataInicio")
);
CREATE INDEX "bonificacoes_papeis_papel_dataInicio_idx" ON "bonificacoes_papeis"("papel", "dataInicio");
CREATE UNIQUE INDEX "bonificacoes_papeis_vigente_key" ON "bonificacoes_papeis"("papel") WHERE "dataFim" IS NULL;
