/**
 * [SCHEMA][VALIDACAO] Validação dos dados de projeto: cliente, tipo de contrato, horas contratadas,
 * valor e datas.
 */

import { z } from "zod";
import { paginationQuerySchema } from "./comunsSchemas.js";
import { statusProjetoSchema } from "./statusProjetoSchema.js";
import { equipeInicialSchema } from "./equipeProjetoSchemas.js";

// [REGRA] Tipos de contrato aceitos (o mesmo enum do banco, em prisma/schema.prisma).
export const tipoContratoSchema = z.enum(["ESCOPO_FECHADO", "POR_HORA", "FEE_MENSAL", "SQUAD"], {
  message: "Tipo de contrato invalido.",
});

export const projetoQuerySchema = paginationQuerySchema.extend({
  status: statusProjetoSchema.optional(),
  clienteId: z.coerce.number().int().positive().optional(),
});

const projetoBaseSchema = z.object({
  clienteId: z.coerce.number().int().positive("Cliente e obrigatorio."),
  nome: z.string().trim().min(2, "Nome do projeto deve ter ao menos 2 caracteres."),
  tipoContrato: tipoContratoSchema,
  horasContratadas: z.coerce.number().positive("Horas contratadas devem ser maiores que zero."),
  valorProjeto: z.coerce.number().positive("Valor do projeto deve ser maior que zero."),
  dataInicio: z.coerce.date(),
  status: z.literal("ATIVO").optional(),
  equipeInicial: equipeInicialSchema.optional(),
});

export const projetoCreateSchema = projetoBaseSchema.superRefine((data, ctx) => {
  const inicioProjeto = data.dataInicio.toISOString().slice(0, 10);
  (data.equipeInicial ?? []).forEach((member, index) => {
    const entrada = member.dataEntrada.toISOString().slice(0, 10);
    if (entrada < inicioProjeto) {
      ctx.addIssue({
        code: "custom",
        path: ["equipeInicial", index, "dataEntrada"],
        message:
          "A data de entrada do colaborador não pode ser anterior à data de início do projeto.",
      });
    }
  });
});

export const projetoUpdateSchema = projetoBaseSchema
  .extend({
    status: statusProjetoSchema.optional(),
    equipeInicial: z.never().optional(),
    // Confirmação explícita para reativar um projeto cancelado ou encerrado (não é gravada).
    confirmarReativacao: z.boolean().optional(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
