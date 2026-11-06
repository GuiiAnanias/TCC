import { z } from "zod";
import { paginationQuerySchema } from "./commonSchemas.js";
import { statusProjetoSchema } from "./statusProjetoSchema.js";

export const tipoContratoSchema = z.enum(["FEE_MENSAL", "ESCOPO_SEMIABERTO", "SQUAD"], {
  message: "Tipo de contrato invalido.",
});

export const projetoQuerySchema = paginationQuerySchema.extend({
  status: statusProjetoSchema.optional(),
  clienteId: z.coerce.number().int().positive().optional(),
});

export const projetoCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive("Cliente e obrigatorio."),
  nome: z.string().trim().min(2, "Nome do projeto deve ter ao menos 2 caracteres."),
  tipoContrato: tipoContratoSchema,
  horasContratadas: z.coerce.number().positive("Horas contratadas devem ser maiores que zero."),
  valorProjeto: z.coerce.number().positive("Valor do projeto deve ser maior que zero."),
  dataInicio: z.coerce.date(),
  status: z.literal("ATIVO").optional(),
});

export const projetoUpdateSchema = projetoCreateSchema
  .extend({ status: statusProjetoSchema.optional() })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
