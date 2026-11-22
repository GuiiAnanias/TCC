/**
 * [SCHEMA][VALIDACAO] Validação dos dados de colaborador: nome (ao menos 3 letras, sem números),
 * e-mail, cargo, departamento e status. Valores do cargo e do departamento vêm das listas de
 * schemas/opcoesCadastro.js.
 */

import { z } from "zod";
import {
  MENSAGEM_NOME_SOBRENOME,
  optionalStatusSchema,
  paginationQuerySchema,
  temNomeESobrenome,
} from "./comunsSchemas.js";
import { departamentosTi, cargosTi } from "./opcoesCadastro.js";

export const colaboradorQuerySchema = paginationQuerySchema;

export const colaboradorCreateSchema = z.object({
  nomeCompleto: z
    .string()
    .trim()
    .min(3, "Nome completo deve ter ao menos 3 caracteres.")
    .refine((nome) => !/\p{N}/u.test(nome), "Nome não pode conter números.")
    .refine(temNomeESobrenome, MENSAGEM_NOME_SOBRENOME),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  cargo: z.enum(cargosTi, { message: "Selecione um cargo válido." }),
  departamento: z.enum(departamentosTi, { message: "Selecione um departamento válido." }),
  status: optionalStatusSchema,
});

export const colaboradorUpdateSchema = colaboradorCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
