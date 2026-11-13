/**
 * [SCHEMA][VALIDACAO] Validação para gerar e listar relatórios. Mensagens dos critérios de aceite:
 * "Selecione ao menos um filtro para gerar o relatório." e "Selecione ao menos um bloco de dados
 * para o relatório.".
 */

import { z } from "zod";
import { statusProjetoSchema } from "./statusProjetoSchema.js";

// Ordem de exibição dos blocos na prévia e nas exportações.
export const BLOCOS_RELATORIO = [
  "PROJETOS",
  "CLIENTES",
  "EQUIPES",
  "HORAS",
  "EVOLUCAO",
  "CUSTO",
  "INCONSISTENCIAS",
  "APONTAMENTOS",
];
export const LIMITE_PROJETOS_RELATORIO = 50;
export const STATUS_APONTAMENTO_RELATORIO = ["PENDENTE", "APROVADO", "FATURADO"];
export const ORDENACOES_RELATORIO = ["NOME", "CUSTO", "HORAS", "ORCAMENTO"];
// Colunas opcionais da tabela de projetos; o nome do projeto sempre aparece.
export const COLUNAS_PROJETOS = [
  "cliente",
  "status",
  "orcamento",
  "horas",
  "custoBase",
  "bonificacao",
  "custo",
  "horasSemCusto",
  "assertividade",
  "inconsistencias",
];

const dia = z
  .string()
  .date("Data inválida.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

// Texto opcional: vazio ou só espaços vira null.
const textoOpcional = (maximo, mensagem) =>
  z
    .string()
    .trim()
    .max(maximo, mensagem)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const relatorioCreateSchema = z
  .object({
    titulo: textoOpcional(120, "O título pode ter até 120 caracteres."),
    observacoes: textoOpcional(1000, "As observações podem ter até 1000 caracteres."),
    equipe: textoOpcional(255, "Equipe inválida."),
    colaboradorId: z.number().int().positive().nullable().optional(),
    statusProjeto: statusProjetoSchema.nullable().optional(),
    // Sem a lista, entram as horas de todos os status.
    statusApontamentos: z
      .array(z.enum(STATUS_APONTAMENTO_RELATORIO, { message: "Status das horas inválido." }))
      .min(1, "Selecione ao menos um status das horas.")
      .optional()
      .transform((lista) =>
        lista ? STATUS_APONTAMENTO_RELATORIO.filter((status) => lista.includes(status)) : undefined,
      ),
    ordenacao: z
      .enum(ORDENACOES_RELATORIO, { message: "Ordenação inválida." })
      .optional()
      .default("NOME"),
    colunasProjetos: z
      .array(z.enum(COLUNAS_PROJETOS, { message: "Coluna inválida." }))
      .optional()
      .transform((lista) =>
        lista ? COLUNAS_PROJETOS.filter((coluna) => lista.includes(coluna)) : undefined,
      ),
    projetoIds: z
      .array(z.number().int().positive())
      .max(LIMITE_PROJETOS_RELATORIO, `Selecione até ${LIMITE_PROJETOS_RELATORIO} projetos.`)
      .default([])
      .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
    clienteIds: z
      .array(z.number().int().positive())
      .max(LIMITE_PROJETOS_RELATORIO, "Selecione até 50 clientes.")
      .default([])
      .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
    dataInicio: dia.nullable().optional(),
    dataFim: dia.nullable().optional(),
    blocos: z
      .array(z.enum(BLOCOS_RELATORIO, { message: "Bloco de relatório inválido." }))
      .min(1, "Selecione ao menos um bloco de dados para o relatório.")
      .transform((blocos) => BLOCOS_RELATORIO.filter((bloco) => blocos.includes(bloco))),
  })
  .strict()
  .refine(
    (data) =>
      data.projetoIds.length > 0 ||
      data.clienteIds.length > 0 ||
      data.dataInicio ||
      data.dataFim ||
      data.equipe ||
      data.colaboradorId,
    {
      path: ["projetoIds"],
      message: "Selecione ao menos um filtro para gerar o relatório.",
    },
  )
  .refine((data) => !data.dataInicio || !data.dataFim || data.dataInicio <= data.dataFim, {
    path: ["dataFim"],
    message: "A data final não pode ser anterior à inicial.",
  });

// Dias do histórico no horário de Brasília (sem horário de verão desde 2019).
const diaDeBrasilia = z
  .string()
  .date("Data inválida.")
  .transform((value) => new Date(`${value}T00:00:00.000-03:00`));

export const LIMITE_POR_PAGINA_HISTORICO = 50;
export const relatorioListaSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(LIMITE_POR_PAGINA_HISTORICO).default(20),
    autorId: z.coerce.number().int().positive().optional(),
    projetoId: z.coerce.number().int().positive().optional(),
    geradoDe: diaDeBrasilia.optional(),
    geradoAte: diaDeBrasilia.optional(),
  })
  .strict()
  .refine((data) => !data.geradoDe || !data.geradoAte || data.geradoDe <= data.geradoAte, {
    path: ["geradoAte"],
    message: "A data final não pode ser anterior à inicial.",
  });
