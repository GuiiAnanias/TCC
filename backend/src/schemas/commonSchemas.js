import { z } from "zod";

export const statusSchema = z.enum(["ATIVO", "INATIVO"], {
  message: "Status deve ser ATIVO ou INATIVO."
});

export const optionalStatusSchema = statusSchema.optional();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  busca: z.string().trim().optional(),
  status: optionalStatusSchema
});
