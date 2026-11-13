/**
 * Blocos e opções que podem ser escolhidos no relatório (mesma ordem e mesmos valores de
 * backend/src/schemas/relatoriosSchemas.js).
 */

export const BLOCOS = [
  {
    key: "PROJETOS",
    label: "Projetos",
    hint: "Orçamento, horas, custo e assertividade de cada projeto",
    padrao: true,
  },
  { key: "CLIENTES", label: "Clientes", hint: "Projetos, horas e custo por cliente", padrao: true },
  {
    key: "EQUIPES",
    label: "Equipes",
    hint: "Horas e custo por departamento",
    padrao: false,
  },
  {
    key: "HORAS",
    label: "Horas totais",
    hint: "Total, por status e por colaborador",
    padrao: true,
  },
  {
    key: "EVOLUCAO",
    label: "Evolução mensal",
    hint: "Horas e custo mês a mês",
    padrao: false,
  },
  {
    key: "CUSTO",
    label: "Custo total",
    hint: "Custo base, bonificação e assertividade média",
    padrao: true,
  },
  {
    key: "INCONSISTENCIAS",
    label: "Inconsistências",
    hint: "Ocorrências da auditoria por tipo",
    padrao: true,
  },
  {
    key: "APONTAMENTOS",
    label: "Apontamentos",
    hint: "Lista de cada lançamento de horas",
    padrao: false,
  },
];

export const BLOCOS_PADRAO = BLOCOS.filter((bloco) => bloco.padrao).map((bloco) => bloco.key);

export const STATUS_HORAS = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "FATURADO", label: "Faturado" },
];

export const ORDENACOES = [
  { value: "NOME", label: "Nome (A a Z)" },
  { value: "CUSTO", label: "Maior custo" },
  { value: "HORAS", label: "Mais horas" },
  { value: "ORCAMENTO", label: "Maior orçamento" },
];

// Colunas opcionais da tabela de projetos; o nome do projeto sempre aparece.
export const COLUNAS_PROJETOS = [
  { value: "cliente", label: "Cliente" },
  { value: "status", label: "Status" },
  { value: "orcamento", label: "Orçamento" },
  { value: "horas", label: "Horas" },
  { value: "custoBase", label: "Custo base" },
  { value: "bonificacao", label: "Bonificação" },
  { value: "custo", label: "Custo total" },
  { value: "horasSemCusto", label: "Horas sem custo" },
  { value: "assertividade", label: "Assertividade" },
  { value: "inconsistencias", label: "Inconsistências" },
];
