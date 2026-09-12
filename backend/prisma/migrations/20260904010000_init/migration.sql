CREATE TYPE "Status" AS ENUM ('ATIVO', 'INATIVO');

CREATE TYPE "TipoContrato" AS ENUM ('FIXO', 'HORAS', 'FECHADO');

CREATE TYPE "TipoBonificacao" AS ENUM ('NENHUMA', 'VALOR_FIXO', 'PERCENTUAL');

CREATE TABLE "usuarios" (
  "id" SERIAL NOT NULL,
  "nomeUsuario" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senhaHash" TEXT NOT NULL,
  "resetToken" TEXT,
  "resetTokenExpiraEm" TIMESTAMP(3),
  "status" "Status" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clientes" (
  "id" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "colaboradores" (
  "id" SERIAL NOT NULL,
  "nomeCompleto" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "cargo" TEXT NOT NULL,
  "departamento" TEXT NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itens_tabela_remuneracao" (
  "id" SERIAL NOT NULL,
  "nivel" TEXT NOT NULL,
  "valorHora" DECIMAL(10, 2) NOT NULL,
  "bonificacao" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "tipoBonificacao" "TipoBonificacao" NOT NULL DEFAULT 'NENHUMA',
  "status" "Status" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "itens_tabela_remuneracao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "configuracoes_financeiras" (
  "id" SERIAL NOT NULL,
  "colaboradorId" INTEGER NOT NULL,
  "itemTabelaId" INTEGER NOT NULL,
  "beneficios" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "dataInicio" TIMESTAMP(3) NOT NULL,
  "dataFim" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "configuracoes_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projetos" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "tipoContrato" "TipoContrato" NOT NULL,
  "horasContratadas" DECIMAL(10, 2) NOT NULL,
  "valorProjeto" DECIMAL(12, 2) NOT NULL,
  "dataInicio" TIMESTAMP(3) NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projetos_colaboradores" (
  "id" SERIAL NOT NULL,
  "projetoId" INTEGER NOT NULL,
  "colaboradorId" INTEGER NOT NULL,
  "papel" TEXT NOT NULL,
  "dataEntrada" TIMESTAMP(3) NOT NULL,
  "dataSaida" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "projetos_colaboradores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_nomeUsuario_key" ON "usuarios"("nomeUsuario");
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "clientes_nome_key" ON "clientes"("nome");
CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");
CREATE UNIQUE INDEX "itens_tabela_remuneracao_nivel_key" ON "itens_tabela_remuneracao"("nivel");

CREATE INDEX "configuracoes_financeiras_colaboradorId_dataInicio_dataFim_idx"
  ON "configuracoes_financeiras"("colaboradorId", "dataInicio", "dataFim");

CREATE INDEX "projetos_clienteId_idx" ON "projetos"("clienteId");
CREATE INDEX "projetos_colaboradores_projetoId_idx" ON "projetos_colaboradores"("projetoId");
CREATE INDEX "projetos_colaboradores_colaboradorId_idx" ON "projetos_colaboradores"("colaboradorId");

ALTER TABLE "configuracoes_financeiras"
  ADD CONSTRAINT "configuracoes_financeiras_colaboradorId_fkey"
  FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "configuracoes_financeiras"
  ADD CONSTRAINT "configuracoes_financeiras_itemTabelaId_fkey"
  FOREIGN KEY ("itemTabelaId") REFERENCES "itens_tabela_remuneracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projetos"
  ADD CONSTRAINT "projetos_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projetos_colaboradores"
  ADD CONSTRAINT "projetos_colaboradores_projetoId_fkey"
  FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projetos_colaboradores"
  ADD CONSTRAINT "projetos_colaboradores_colaboradorId_fkey"
  FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
