import { z } from "zod";

export const configuracaoFinanceiraCreateSchema = z.object({
  itemTabelaId: z.coerce.number().int().positive("Faixa de remuneração é obrigatória."),
  beneficios: z.coerce.number().min(0, "Benefícios não podem ser negativos.").default(0),
  dataInicio: z.coerce.date()
});

export const configuracaoFinanceiraUpdateSchema = z
  .object({
    itemTabelaId: z.coerce.number().int().positive("Faixa de remuneração é obrigatória.").optional(),
    beneficios: z.coerce.number().min(0, "Benefícios não podem ser negativos.").optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
