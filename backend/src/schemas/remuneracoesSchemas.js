import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";
import { niveisRemuneracao } from "./cadastroOptions.js";

export const tipoBonificacaoSchema = z.enum(["NENHUMA", "VALOR_FIXO", "PERCENTUAL"], {
  message: "Tipo de bonificação inválido."
});

export const remuneracaoQuerySchema = paginationQuerySchema;

export const remuneracaoCreateSchema = z.object({
  nivel: z.enum(niveisRemuneracao, { message: "Selecione um nível de remuneração válido." }),
  valorHora: z.coerce.number().finite().min(0.01, "Valor hora deve ser de pelo menos R$ 0,01.").max(99999999.99).multipleOf(0.01, "Use no máximo duas casas decimais."),
  bonificacao: z.coerce.number().min(0, "Bonificação não pode ser negativa.").default(0),
  tipoBonificacao: tipoBonificacaoSchema.default("NENHUMA"),
  status: optionalStatusSchema
});

export const remuneracaoUpdateSchema = remuneracaoCreateSchema.partial().extend({
  // O serviço permite preservar o nome legado do próprio registro, sem liberar
  // a criação ou troca para nomes fora do catálogo de níveis.
  nivel: z.string().trim().min(1).max(255).optional(),
  bonificacao: z.coerce.number().min(0, "Bonificação não pode ser negativa.").optional(),
  tipoBonificacao: tipoBonificacaoSchema.optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
