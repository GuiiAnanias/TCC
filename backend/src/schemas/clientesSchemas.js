import { z } from "zod";
import { optionalStatusSchema, paginationQuerySchema } from "./commonSchemas.js";
import { isValidCnpj, normalizeCnpj } from "../utils/cnpj.js";

export const cnpjSchema = z.string().transform(normalizeCnpj).refine(isValidCnpj, "CNPJ inválido. Confira os caracteres e os dígitos verificadores.");
const text = (max = 255) => z.string().trim().max(max).nullable().optional();

export const clienteQuerySchema = paginationQuerySchema;

export const clienteCreateSchema = z.object({
  nome: z.string().trim().min(2, "Razão social deve ter ao menos 2 caracteres.").max(255),
  cnpj: cnpjSchema,
  nomeFantasia: text(),
  email: z.string().trim().email("E-mail inválido.").max(255).nullable().optional(),
  telefone: text(50),
  contato: text(),
  cep: z.string().transform((value) => value.replace(/[.\-\s]/g, "")).pipe(z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos.")).nullable().optional(),
  logradouro: text(),
  numero: text(30),
  complemento: text(),
  bairro: text(),
  cidade: text(150),
  estado: z.string().trim().toUpperCase().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/, "Selecione uma UF válida.").nullable().optional(),
  situacaoCadastral: text(80),
  abertura: text(30),
  porte: text(100),
  naturezaJuridica: text(),
  atividadePrincipal: text(),
  status: optionalStatusSchema
});

export const clienteUpdateSchema = clienteCreateSchema.partial().extend({ cnpj: cnpjSchema.nullable().optional() }).refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar."
);
