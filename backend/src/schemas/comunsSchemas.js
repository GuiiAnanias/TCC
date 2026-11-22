/**
 * [SCHEMA][VALIDACAO] Schemas Zod reaproveitados: status Ativo/Inativo, id da URL e paginação.
 */

import { z } from "zod";

export const statusSchema = z.enum(["ATIVO", "INATIVO"], {
  message: "Status deve ser ATIVO ou INATIVO.",
});

export const optionalStatusSchema = statusSchema.optional();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginationQuerySchema = z.object({
  busca: z.string().trim().optional(),
  status: optionalStatusSchema,
});

export const MENSAGEM_NOME_SOBRENOME = "Informe no mínimo um nome e sobrenome.";

export function temNomeESobrenome(value) {
  const partes = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return partes.length >= 2 && partes.every((parte) => /\p{L}/u.test(parte));
}
