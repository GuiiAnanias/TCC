import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";

export const tipoBonificacaoSchema = z.enum(["NENHUMA", "VALOR_FIXO", "PERCENTUAL"], {
  message: "Tipo de bonificação inválido."
});

export const remuneracaoQuerySchema = paginationQuerySchema;

export const remuneracaoCreateSchema = z.object({
  nivel: z.string().trim().min(2, "Nível deve ter ao menos 2 caracteres."),
  valorHora: z.coerce.number().positive("Valor hora deve ser maior que zero."),
  bonificacao: z.coerce.number().min(0, "Bonificação não pode ser negativa.").default(0),
  tipoBonificacao: tipoBonificacaoSchema.default("NENHUMA"),
  status: optionalStatusSchema
});

export const remuneracaoUpdateSchema = remuneracaoCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
