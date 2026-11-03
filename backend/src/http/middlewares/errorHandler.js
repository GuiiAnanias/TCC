import prismaPackage from "@prisma/client";
const { Prisma } = prismaPackage;
import { ZodError } from "zod";
import { env } from "../../config/env.js";
import { custoConflict } from "../../utils/custoConflict.js";

export function notFoundHandler(request, response) {
  response.status(404).json({
    message: "Rota não encontrada.",
  });
}

export function errorHandler(error, request, response, _next) {
  const conflict = custoConflict(error);
  if (conflict) return response.status(conflict.statusCode).json({ message: conflict.message });
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Dados inválidos.",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

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

  if (error.name === "PrismaClientInitializationError") {
    return response.status(503).json({
      message:
        "Banco de dados indisponível. Verifique se o PostgreSQL está rodando em localhost:5432.",
    });
  }

  const statusCode = error.statusCode || 500;

  return response.status(statusCode).json({
    message: error.message || "Erro interno do servidor.",
    details: error.details || undefined,
    stack: env.nodeEnv === "development" ? error.stack : undefined,
  });
}
