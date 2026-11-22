/**
 * [SCHEMA][VALIDACAO] Validação dos dados de cliente (PF e PJ) com Zod. Usado no clientesController
 * antes de qualquer gravação; erro aqui vira 400 com a lista de campos.
 */

import { z } from "zod";
import {
  MENSAGEM_NOME_SOBRENOME,
  optionalStatusSchema,
  paginationQuerySchema,
  temNomeESobrenome,
} from "./comunsSchemas.js";
import { isValidCnpj, normalizeCnpj } from "../utils/cnpj.js";
import { isValidCpf, normalizeCpf } from "../utils/cpf.js";

export const cnpjSchema = z
  .string()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, "CNPJ inválido. Confira os caracteres e os dígitos verificadores.");
// Texto opcional: tira espaços das pontas e limita o tamanho.
const text = (max = 255) => z.string().trim().max(max).nullable().optional();

export const clienteQuerySchema = paginationQuerySchema;

// [VALIDACAO] Campos comuns e formatos: CNPJ com dígitos verificadores, CPF, e-mail, telefone (DDD
// + 10 ou 11 dígitos), CEP (8 dígitos) e UF.
const clienteBaseSchema = z.object({
  tipoPessoa: z.enum(["PF", "PJ"]).optional(),
  nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres.").max(255),
  cnpj: cnpjSchema.nullable().optional(),
  cpf: z
    .string()
    .transform(normalizeCpf)
    .refine(isValidCpf, "CPF inválido. Confira os dígitos verificadores.")
    .nullable()
    .optional(),
  nomeFantasia: text(),
  email: z.string().trim().email("E-mail inválido.").max(255).nullable().optional(),
  telefone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[()\s.-]/g, ""))
    .pipe(z.string().regex(/^[1-9]\d{9,10}$/, "Informe um telefone com DDD e 10 ou 11 dígitos."))
    .nullable()
    .optional(),
  contato: text(),
  cep: z
    .string()
    .transform((value) => value.replace(/[.\-\s]/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos."))
    .nullable()
    .optional(),
  logradouro: text(),
  numero: text(30),
  complemento: text(),
  bairro: text(),
  cidade: text(150),
  estado: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
      "Selecione uma UF válida.",
    )
    .nullable()
    .optional(),
  situacaoCadastral: text(80),
  abertura: text(30),
  porte: text(100),
  naturezaJuridica: text(),
  atividadePrincipal: text(),
  status: optionalStatusSchema,
});

// Campos que só existem para pessoa jurídica (dados da Receita).
const companyFields = [
  "cnpj",
  "nomeFantasia",
  "contato",
  "situacaoCadastral",
  "abertura",
  "porte",
  "naturezaJuridica",
  "atividadePrincipal",
];

// [VALIDACAO][REGRA] PF exige CPF e não aceita CNPJ nem campos de empresa; PJ exige CNPJ e não
// aceita CPF.
function validatePersonFields(data, ctx) {
  if (data.tipoPessoa === "PF") {
    if (data.nome !== undefined && !temNomeESobrenome(data.nome)) {
      ctx.addIssue({
        code: "custom",
        path: ["nome"],
        message: MENSAGEM_NOME_SOBRENOME,
      });
    }
    for (const field of companyFields) {
      if (data[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Este campo pertence a uma pessoa jurídica.",
        });
    }
  }
  if (data.tipoPessoa === "PJ" && data.cpf)
    ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF pertence a uma pessoa física." });
}

export const clienteCreateSchema = clienteBaseSchema
  .extend({ tipoPessoa: z.enum(["PF", "PJ"]).default("PJ") })
  .superRefine((data, ctx) => {
    const document = data.tipoPessoa === "PF" ? "cpf" : "cnpj";
    if (!data[document])
      ctx.addIssue({
        code: "custom",
        path: [document],
        message: `Informe o ${document.toUpperCase()}.`,
      });
    validatePersonFields(data, ctx);
  });

export const clienteUpdateSchema = clienteBaseSchema
  .partial()
  .superRefine(validatePersonFields)
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
