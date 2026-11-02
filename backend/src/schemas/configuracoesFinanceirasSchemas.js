import { z } from "zod";

export const configuracaoFinanceiraCreateSchema = z.object({
  itemTabelaId: z.coerce.number().int().positive("Faixa de remuneração é obrigatória."),
  beneficios: z.coerce
    .number()
    .finite()
    .min(0, "Benefícios não podem ser negativos.")
    .max(99999999.99)
    .multipleOf(0.01, "Use no máximo duas casas decimais.")
    .default(0),
  dataInicio: z
    .string()
    .date()
    .transform((value) => new Date(`${value}T00:00:00.000Z`)),
  motivo: z.string().trim().max(500).optional(),
});

export const configuracaoFinanceiraUpdateSchema = z
  .object({
    itemTabelaId: z.coerce
      .number()
      .int()
      .positive("Faixa de remuneração é obrigatória.")
      .optional(),
    beneficios: configuracaoFinanceiraCreateSchema.shape.beneficios.optional(),
    dataVigencia: z
      .string()
      .date()
      .transform((value) => new Date(`${value}T00:00:00.000Z`))
      .optional(),
    motivo: z.string().trim().max(500).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
