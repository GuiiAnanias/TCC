import { z } from "zod";
import { paginationQuerySchema } from "./commonSchemas.js";
export const apontamentoQuerySchema = paginationQuerySchema.extend({ colaboradorId: z.coerce.number().int().positive().optional(), projetoId: z.coerce.number().int().positive().optional(), dataInicio: z.coerce.date().optional(), dataFim: z.coerce.date().optional() });
export const apontamentoCreateSchema = z.object({ colaboradorId: z.coerce.number().int().positive(), projetoId: z.coerce.number().int().positive(), data: z.coerce.date({ errorMap: () => ({ message: "Data inválida." }) }), horas: z.coerce.number().positive("As horas devem ser maiores que zero."), status: z.enum(['PENDENTE', 'APROVADO', 'FATURADO']).default('PENDENTE'), descricao: z.string().trim().min(3, "Descrição muito curta.") });
export const apontamentoUpdateSchema = apontamentoCreateSchema.partial().refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
