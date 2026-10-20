import { dashboardRepository } from "../repositories/dashboardRepository.js";
import { bonificacoesPapeisRepository } from "../repositories/bonificacoesPapeisRepository.js";

import { round, operationalIndicators, taskInScope } from "./operationalIndicators.js";
import { entryCost } from "./dashboardCosts.js";
const sum = (rows, key) => round(rows.reduce((total, row) => total + Number(row[key]), 0));
const dayOf = (value) => new Date(value).toISOString().slice(0, 10);

export function summarizeDashboard(projects, filters = {}, bonuses = []) {
  const period = Boolean(filters.dataInicio || filters.dataFim);
  const visible = projects.filter((p) => !period || p.apontamentos.length > 0 || (p.tarefas ?? []).some((task) => taskInScope(task, filters)));
  const occurrences = [];
  const rows = visible.map((project) => {
    let custoBase = 0;
    let bonificacao = 0;
    let horasSemCusto = 0;
    let registrosSemCusto = 0;
    const vinculosAusentes = [];
    for (const entry of project.apontamentos) {
      const day = dayOf(entry.data);
      const cost = entryCost(entry, project, bonuses);
      const occurrence = { apontamentoId: entry.id, projetoId: project.id, projeto: project.nome, colaboradorId: entry.colaboradorId, colaborador: entry.colaborador.nomeCompleto || "Colaborador", data: day };
      if (cost.semVinculo) {
        vinculosAusentes.push(occurrence);
        occurrences.push({ ...occurrence, tipo: "SEM_VINCULO", descricao: "Sem participação de equipe válida na data das horas." });
      }
      if (cost.semCusto) {
        horasSemCusto += Number(entry.horas); registrosSemCusto++;
        occurrences.push({ ...occurrence, tipo: "SEM_REMUNERACAO", descricao: "Sem valor/hora preservado vigente na data das horas." });
      }
      if (!entry.tarefaId) occurrences.push({ ...occurrence, tipo: "SEM_TAREFA", descricao: "Apontamento sem tarefa; classificação de correção desconhecida." });
      custoBase += cost.custoBase; bonificacao += cost.bonificacao;
    }
    const horas = sum(project.apontamentos, "horas");
    const orcamento = Number(project.valorProjeto);
    const custo = round(round(custoBase) + round(bonificacao));
    // Fórmula da e/code: orçado / realizado × 100, inclusive acima de 100%.
    // Não comparar orçamento integral com custo de apenas parte do período/equipe.
    const assertividade = !period && !filters.equipe && !filters.colaboradorId && !filters.sprintId && horas > 0 && !registrosSemCusto && orcamento > 0 && custo > 0
      ? round(orcamento / custo * 100) : null;
    return {
      id: project.id, nome: project.nome, status: project.status,
      clienteId: project.clienteId, cliente: project.cliente.nome,
      horas, custo, custoBase: round(custoBase), bonificacao: round(bonificacao),
      registrosSemVinculo: vinculosAusentes.length, vinculosAusentes, orcamento,
      horasSemCusto: round(horasSemCusto), inconsistencias: registrosSemCusto + vinculosAusentes.length, assertividade,
      operacionais: operationalIndicators([project], filters).indicadores
    };
  });
  const clients = new Map();
  for (const row of rows) {
    if (!clients.has(row.clienteId)) clients.set(row.clienteId, {
      id: row.clienteId, nome: row.cliente, projetos: 0, horas: 0, custo: 0, custoBase: 0,
      bonificacao: 0, horasSemCusto: 0
    });
    const client = clients.get(row.clienteId);
    client.projetos++;
    for (const key of ["horas", "custo", "custoBase", "bonificacao", "horasSemCusto"]) client[key] = round(client[key] + row[key]);
  }
  const comparable = rows.filter((row) => row.assertividade !== null);
  // Consolidação escolhida para a interface: média aritmética dos projetos elegíveis.
  const assertividade = comparable.length ? round(sum(comparable, "assertividade") / comparable.length) : null;
  const operational = operationalIndicators(visible, filters);
  occurrences.push(...operational.ocorrencias);
  const detailedOccurrences = occurrences.map((row, index) => ({ ...row, chave: `${row.tipo}:${row.projetoId}:${row.tarefaId ?? row.apontamentoId ?? index}` }));
  return {
    resumo: {
      projetos: rows.length, projetosAtivos: rows.filter((p) => p.status === "ATIVO").length,
      clientes: clients.size, custo: sum(rows, "custo"), horas: sum(rows, "horas"),
      custoBase: sum(rows, "custoBase"), bonificacao: sum(rows, "bonificacao"),
      registrosSemVinculo: sum(rows, "registrosSemVinculo"),
      vinculosAusentes: rows.flatMap((row) => row.vinculosAusentes),
      horasSemCusto: sum(rows, "horasSemCusto"), inconsistencias: sum(rows, "inconsistencias"),
      assertividade, projetosComAssertividade: comparable.length,
      ...operational.indicadores,
      totalOcorrencias: detailedOccurrences.length,
      ocorrenciasOperacionais: detailedOccurrences.filter((row) => !["SEM_REMUNERACAO", "SEM_VINCULO"].includes(row.tipo)).length
    },
    projetos: rows,
    ocorrencias: detailedOccurrences,
    tarefas: operational.tarefas,
    auditoria: [...rows].sort((a, b) => (a.assertividade ?? Infinity) - (b.assertividade ?? Infinity) || a.nome.localeCompare(b.nome, "pt-BR")),
    clientes: [...clients.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  };
}

export const dashboardService = {
  async get(filters) {
    const [projects, bonuses] = await Promise.all([dashboardRepository.load(filters), bonificacoesPapeisRepository.findAll()]);
    return summarizeDashboard(projects, filters, bonuses);
  },
  options() { return dashboardRepository.options(); }
};
