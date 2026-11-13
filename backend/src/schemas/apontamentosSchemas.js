/**
 * [SCHEMA][VALIDACAO] Validação dos apontamentos de horas: horas maiores que zero com até duas
 * casas, descrição com ao menos 3 caracteres, status e filtros da listagem. As regras que dependem
 * do banco (24 h por dia, equipe, faturamento) ficam em services/apontamentosService.js.
 */

import { z } from "zod";
import { paginationQuerySchema } from "./comunsSchemas.js";
// [REGRA] Pendente, Aprovado ou Faturado.
const statusApontamentoSchema = z.enum(["PENDENTE", "APROVADO", "FATURADO"]);
export const apontamentoQuerySchema = paginationQuerySchema.extend({
  status: statusApontamentoSchema.optional(),
  colaboradorId: z.coerce.number().int().positive().optional(),
  projetoId: z.coerce.number().int().positive().optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
});
export const apontamentoCreateSchema = z.object({
  colaboradorId: z.coerce.number().int().positive(),
  projetoId: z.coerce.number().int().positive(),
  tarefaId: z.coerce.number().int().positive().nullable().optional(),
  data: z.coerce.date({ errorMap: () => ({ message: "Data inválida." }) }),
  horas: z.coerce
    .number()
    .finite()
    .positive("As horas devem ser maiores que zero.")
    .max(999.99)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
      "Informe até duas casas decimais.",
    ),
  status: z.enum(["PENDENTE", "APROVADO", "FATURADO"]).default("PENDENTE"),
  descricao: z.string().trim().min(3, "Descrição muito curta."),
});
export const apontamentoUpdateSchema = apontamentoCreateSchema
  .partial()
  .extend({ status: statusApontamentoSchema.optional() })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
