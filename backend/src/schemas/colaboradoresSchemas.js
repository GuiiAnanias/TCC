import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";
import { departamentosTi, funcoesTi } from "./cadastroOptions.js";

export const colaboradorQuerySchema = paginationQuerySchema;

export const colaboradorCreateSchema = z.object({
  nomeCompleto: z.string().trim().min(3, "Nome completo deve ter ao menos 3 caracteres.").refine(
    (nome) => !/\p{N}/u.test(nome), "Nome não pode conter números."
  ),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  cargo: z.enum(funcoesTi, { message: "Selecione uma função de TI válida." }),
  departamento: z.enum(departamentosTi, { message: "Selecione um departamento válido." }),
  status: optionalStatusSchema
});

export const colaboradorUpdateSchema = colaboradorCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
