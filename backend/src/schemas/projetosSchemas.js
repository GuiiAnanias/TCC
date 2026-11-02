import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";

export const tipoContratoSchema = z.enum(["FIXO", "HORAS", "FECHADO"], {
  message: "Tipo de contrato invalido.",
});

export const projetoQuerySchema = paginationQuerySchema.extend({
  clienteId: z.coerce.number().int().positive().optional(),
});

export const projetoCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive("Cliente e obrigatorio."),
  nome: z.string().trim().min(2, "Nome do projeto deve ter ao menos 2 caracteres."),
  tipoContrato: tipoContratoSchema,
  horasContratadas: z.coerce.number().positive("Horas contratadas devem ser maiores que zero."),
  valorProjeto: z.coerce.number().positive("Valor do projeto deve ser maior que zero."),
  dataInicio: z.coerce.date(),
  status: optionalStatusSchema,
});

export const projetoUpdateSchema = projetoCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
