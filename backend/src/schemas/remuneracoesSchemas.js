import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";
import { funcoesTi } from "./cadastroOptions.js";

export const tipoBonificacaoSchema = z.enum(["NENHUMA", "VALOR_FIXO", "PERCENTUAL"], {
  message: "Tipo de bonificação inválido."
});

export const remuneracaoQuerySchema = paginationQuerySchema;

export const remuneracaoCreateSchema = z.object({
  nivel: z.enum(funcoesTi, { message: "Selecione uma função de TI válida para a faixa." }),
  valorHora: z.coerce.number().positive("Valor hora deve ser maior que zero."),
  bonificacao: z.coerce.number().min(0, "Bonificação não pode ser negativa.").default(0),
  tipoBonificacao: tipoBonificacaoSchema.default("NENHUMA"),
  status: optionalStatusSchema
});

export const remuneracaoUpdateSchema = remuneracaoCreateSchema.partial().extend({
  bonificacao: z.coerce.number().min(0, "Bonificação não pode ser negativa.").optional(),
  tipoBonificacao: tipoBonificacaoSchema.optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
