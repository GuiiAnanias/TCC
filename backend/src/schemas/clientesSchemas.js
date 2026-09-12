import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";

export const clienteQuerySchema = paginationQuerySchema;

export const clienteCreateSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres."),
  status: optionalStatusSchema
});

export const clienteUpdateSchema = clienteCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
