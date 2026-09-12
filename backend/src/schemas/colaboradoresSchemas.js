import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";

export const colaboradorQuerySchema = paginationQuerySchema;

export const colaboradorCreateSchema = z.object({
  nomeCompleto: z.string().trim().min(3, "Nome completo deve ter ao menos 3 caracteres."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  cargo: z.string().trim().min(2, "Cargo deve ter ao menos 2 caracteres."),
  departamento: z.string().trim().min(2, "Departamento deve ter ao menos 2 caracteres."),
  status: optionalStatusSchema
});

export const colaboradorUpdateSchema = colaboradorCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
