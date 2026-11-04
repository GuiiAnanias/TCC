BEGIN;
CREATE TABLE "limites_autenticacao" (
  "chave" TEXT NOT NULL PRIMARY KEY,
  "tentativas" INTEGER NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "limites_autenticacao_expiraEm_idx" ON "limites_autenticacao"("expiraEm");
COMMIT;
