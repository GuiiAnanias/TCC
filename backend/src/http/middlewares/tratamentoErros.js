/**
 * [ERRO] Tratamento central de erros da API. Todo erro lançado em rota, controller, service ou
 * repository chega aqui e vira uma resposta JSON com status HTTP e mensagem em português.
 */

import prismaPackage from "@prisma/client";
const { Prisma } = prismaPackage;
import { ZodError } from "zod";
import { env } from "../../config/env.js";
import { conflitoCusto } from "../../utils/conflitoCusto.js";

// [ERRO] Rota que não existe: 404 "Rota não encontrada."
export function rotaNaoEncontrada(request, response) {
  response.status(404).json({
    message: "Rota não encontrada.",
  });
}

// [ERRO] Converte cada tipo de erro no status certo. A ordem dos testes abaixo importa.
export function tratarErros(error, request, response, _next) {
  // [ERRO] Bloqueio dos gatilhos do banco (custo de apontamento faturado) vira 409 com orientação
  // ao usuário (utils/conflitoCusto.js).
  const conflict = conflitoCusto(error);
  if (conflict) return response.status(conflict.statusCode).json({ message: conflict.message });
  // [ERRO][VALIDACAO] Falha de schema Zod: 400 "Dados inválidos." com a lista de campos e
  // mensagens.
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Dados inválidos.",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // [ERRO][BANCO] Erros conhecidos do Prisma: P2002 = valor único repetido (409); P2025 = registro
  // não encontrado (404).
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return response.status(409).json({
        message: "Já existe um registro com estes dados.",
      });
    }

    if (error.code === "P2025") {
      return response.status(404).json({
        message: "Registro não encontrado.",
      });
    }
  }

  // [ERRO][BANCO] Banco fora do ar: 503 com a orientação de subir o PostgreSQL.
  if (error.name === "PrismaClientInitializationError") {
    return response.status(503).json({
      message:
        "Banco de dados indisponível. Verifique se o PostgreSQL está rodando em localhost:5432.",
    });
  }

  // [ERRO] Erros de regra de negócio (ErroHttp) trazem o próprio status; qualquer outro vira 500.
  // [SEGURANCA] O stack só aparece em desenvolvimento (NODE_ENV).
  const statusCode = error.statusCode || 500;

  return response.status(statusCode).json({
    message: error.message || "Erro interno do servidor.",
    details: error.details || undefined,
    stack: env.nodeEnv === "development" ? error.stack : undefined,
  });
}
