/**
 * [BANCO] Cria a conexão única com o PostgreSQL pelo Prisma (DATABASE_URL do .env). Os repositories
 * importam este cliente; controllers e services não acessam o banco direto.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
