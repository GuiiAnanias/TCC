BEGIN;
ALTER TABLE "usuarios" ADD COLUMN "versaoSessao" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "sessoes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "versaoSessao" INTEGER NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "revogadaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sessoes_usuarioId_expiraEm_idx" ON "sessoes"("usuarioId", "expiraEm");
COMMIT;
