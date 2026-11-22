/**
 * [SCHEMA][VALIDACAO] Validação de tarefas e sprints: títulos, status, estimativa em minutos,
 * responsáveis e datas coerentes (fim não pode ser antes do início).
 */

import { z } from "zod";

const id = z.coerce.number().int().positive();
const day = z
  .string()
  .date("Data inválida.")
  .transform((value) => new Date(`${value}T00:00:00Z`));
// [VALIDACAO] Data final vazia ou igual/posterior à inicial.
const dates = (start, end) => !start || !end || start <= end;
// [REGRA] Planejada, Em andamento, Concluída ou Cancelada.
export const statusTarefa = z.enum(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]);
const statusRegistro = z.enum(["ATIVO", "INATIVO"]);
const sprintFields = z.object({
  projetoId: id,
  nome: z.string().trim().min(3).max(150),
  // O que foi feito ou planejado na sprint; vazio vira null.
  descricao: z
    .string()
    .trim()
    .max(3000, "A descrição pode ter até 3000 caracteres.")
    .nullable()
    .optional()
    .transform((value) => value || null),
  dataInicio: day.nullable().optional(),
  dataFim: day.nullable().optional(),
  statusRegistro: statusRegistro.default("ATIVO"),
});
const taskFields = z.object({
  projetoId: id,
  sprintId: id.nullable().optional(),
  titulo: z.string().trim().min(3).max(200),
  descricao: z.string().trim().max(3000).nullable().optional(),
  status: statusTarefa.default("PLANEJADA"),
  minutosEstimados: z.number().int().positive().max(6000000).nullable().optional(),
  correcao: z.boolean().default(false),
  dataInicio: day.nullable().optional(),
  dataConclusao: day.nullable().optional(),
  statusRegistro: statusRegistro.default("ATIVO"),
  responsavelIds: z
    .array(id)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Responsável repetido.")
    .optional(),
});
const sprintPeriod = (value) => dates(value.dataInicio, value.dataFim);
const taskPeriod = (value) => dates(value.dataInicio, value.dataConclusao);
export const sprintCreateSchema = sprintFields.refine(sprintPeriod, {
  message: "O fim não pode ser anterior ao início.",
  path: ["dataFim"],
});
export const sprintUpdateSchema = sprintFields
  .partial()
  .extend({ statusRegistro: statusRegistro.optional() })
  .refine(sprintPeriod, { message: "O fim não pode ser anterior ao início.", path: ["dataFim"] })
  .refine((data) => Object.keys(data).length > 0, "Informe uma alteração.");
export const tarefaCreateSchema = taskFields
  .refine(taskPeriod, {
    message: "A conclusão não pode ser anterior ao início.",
    path: ["dataConclusao"],
  })
  .refine((value) => !value.dataConclusao || value.status === "CONCLUIDA", {
    message: "Data de conclusão exige status Concluída.",
    path: ["dataConclusao"],
  });
export const tarefaUpdateSchema = taskFields
  .partial()
  .extend({
    status: statusTarefa.optional(),
    correcao: z.boolean().optional(),
    statusRegistro: statusRegistro.optional(),
  })
  .refine(taskPeriod, {
    message: "A conclusão não pode ser anterior ao início.",
    path: ["dataConclusao"],
  })
  .refine((data) => Object.keys(data).length > 0, "Informe uma alteração.");
export const tarefaQuerySchema = z.object({
  projetoId: id.optional(),
  sprintId: id.optional(),
  busca: z.string().trim().max(200).optional(),
  status: statusTarefa.optional(),
  statusRegistro: statusRegistro.optional(),
});
export const sprintQuerySchema = tarefaQuerySchema.pick({
  projetoId: true,
  busca: true,
  statusRegistro: true,
});
