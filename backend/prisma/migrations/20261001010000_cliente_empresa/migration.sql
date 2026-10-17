ALTER TABLE "clientes"
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "nomeFantasia" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "telefone" TEXT,
ADD COLUMN "contato" TEXT,
ADD COLUMN "cep" TEXT,
ADD COLUMN "logradouro" TEXT,
ADD COLUMN "numero" TEXT,
ADD COLUMN "complemento" TEXT,
ADD COLUMN "bairro" TEXT,
ADD COLUMN "cidade" TEXT,
ADD COLUMN "estado" TEXT,
ADD COLUMN "situacaoCadastral" TEXT,
ADD COLUMN "abertura" TEXT,
ADD COLUMN "porte" TEXT,
ADD COLUMN "naturezaJuridica" TEXT,
ADD COLUMN "atividadePrincipal" TEXT;

CREATE UNIQUE INDEX "clientes_cnpj_key" ON "clientes"("cnpj");
