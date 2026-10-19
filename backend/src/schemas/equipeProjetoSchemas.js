import { z } from "zod";
import { papeisProjeto } from "./cadastroOptions.js";
export { papeisProjeto } from "./cadastroOptions.js";

export const equipeProjetoCreateSchema = z.object({
  colaboradorId: z.coerce.number().int().positive("Colaborador é obrigatório."),
  papel: z.enum(papeisProjeto, { message: "Papel do colaborador inválido." }),
  dataEntrada: z.coerce.date()
});

export const equipeProjetoUpdateSchema = z
  .object({
    papel: z.enum(papeisProjeto, { message: "Papel do colaborador inválido." }).optional(),
    dataEntrada: z.coerce.date().optional(),
    dataSaida: z.coerce.date().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
