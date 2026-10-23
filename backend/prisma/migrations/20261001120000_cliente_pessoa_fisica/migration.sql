CREATE TYPE "TipoPessoa" AS ENUM ('PF', 'PJ');
ALTER TABLE "clientes" ADD COLUMN "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'PJ',
  ADD COLUMN "cpf" TEXT;
CREATE UNIQUE INDEX "clientes_cpf_key" ON "clientes"("cpf");
DROP INDEX "clientes_nome_key";
