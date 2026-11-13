/**
 * [SERVICE][REGRA] Indicadores do Dashboard Geral e dos dashboards por projeto e colaborador:
 * horas, custos, assertividade do orçamento, ocorrências de auditoria, resumos por cliente e equipe
 * e as séries dos gráficos.
 */

import { dashboardRepository } from "../repositories/dashboardRepository.js";
import { bonificacoesPapeisRepository } from "../repositories/bonificacoesPapeisRepository.js";

import { round, operationalIndicators, taskInScope } from "./operationalIndicators.js";
import { entryCost } from "./dashboardCosts.js";
import { HttpError } from "../utils/HttpError.js";
const sum = (rows, key) => round(rows.reduce((total, row) => total + Number(row[key]), 0));
const dayOf = (value) => new Date(value).toISOString().slice(0, 10);
export const SEM_DEPARTAMENTO = "Sem departamento";
// [REGRA] Tipos de ocorrência da auditoria (sem remuneração, sem equipe, sem tarefa, sem
// estimativa, concluída sem horas).
export const TIPOS_OCORRENCIA = [
  "SEM_REMUNERACAO",
  "SEM_VINCULO",
  "SEM_TAREFA",
  "SEM_ESTIMATIVA",
  "CONCLUIDA_SEM_HORAS",
];

/**
 * Equipe = departamento do colaborador. Cada apontamento tem um único colaborador, então
 * horas e custos somam por apontamento e nunca se repetem entre equipes, nem quando a
 * tarefa tem vários responsáveis.
 */
function novaEquipe(nome) {
  return {
    equipe: nome,
    colaboradores: new Set(),
    projetos: new Set(),
    horas: 0,
    custoBase: 0,
    bonificacao: 0,
    horasSemCusto: 0,
    pendencias: 0,
  };
}

function fecharEquipes(equipes) {
  return [...equipes.values()]
    .map((row) => {
      const custoBase = round(row.custoBase);
      const bonificacao = round(row.bonificacao);
      return {
        ...row,
        colaboradores: row.colaboradores.size,
        projetos: row.projetos.size,
        horas: round(row.horas),
        custoBase,
        bonificacao,
        custo: round(custoBase + bonificacao),
        horasSemCusto: round(row.horasSemCusto),
      };
    })
    .sort((a, b) => b.horas - a.horas || a.equipe.localeCompare(b.equipe, "pt-BR"));
}

/** Projetos do que tem mais para o que tem menos ocorrências, com a contagem por tipo. */
function rankingDeInconsistencias(rows, occurrences) {
  const porProjeto = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        nome: row.nome,
        status: row.status,
        total: 0,
        porTipo: Object.fromEntries(TIPOS_OCORRENCIA.map((tipo) => [tipo, 0])),
      },
    ]),
  );
  for (const occurrence of occurrences) {
    const project = porProjeto.get(occurrence.projetoId);
    if (!project) continue;
    project.total++;
    project.porTipo[occurrence.tipo] = (project.porTipo[occurrence.tipo] ?? 0) + 1;
  }
  return [...porProjeto.values()].sort(
    (a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

// [REGRA] Monta o resumo do recorte. Assertividade do orçamento = orçamento / custo realizado x
// 100.
export function summarizeDashboard(projects, filters = {}, bonuses = []) {
  const period = Boolean(filters.dataInicio || filters.dataFim);
  const visible = projects.filter(
    (p) =>
      !period ||
      p.apontamentos.length > 0 ||
      (p.tarefas ?? []).some((task) => taskInScope(task, filters)),
  );
  const occurrences = [];
  const equipes = new Map();
  // Séries dos gráficos do dashboard geral, somadas sobre os mesmos apontamentos dos cartões.
  const meses = new Map();
  const porStatus = new Map(
    STATUS_APONTAMENTO.map((status) => [
      status,
      { status, apontamentos: 0, horas: 0, custoBase: 0, bonificacao: 0 },
    ]),
  );
  const rows = visible.map((project) => {
    let custoBase = 0;
    let bonificacao = 0;
    let horasSemCusto = 0;
    let registrosSemCusto = 0;
    const vinculosAusentes = [];
    for (const entry of project.apontamentos) {
      const day = dayOf(entry.data);
      const cost = entryCost(entry, project, bonuses);
      const nomeEquipe = entry.colaborador?.departamento?.trim() || SEM_DEPARTAMENTO;
      if (!equipes.has(nomeEquipe)) equipes.set(nomeEquipe, novaEquipe(nomeEquipe));
      const equipe = equipes.get(nomeEquipe);
      equipe.colaboradores.add(entry.colaboradorId);
      equipe.projetos.add(project.id);
      equipe.horas += Number(entry.horas);
      equipe.custoBase += cost.custoBase;
      equipe.bonificacao += cost.bonificacao;
      if (cost.semCusto) equipe.horasSemCusto += Number(entry.horas);
      equipe.pendencias +=
        Number(cost.semVinculo) + Number(cost.semCusto) + Number(!entry.tarefaId);
      const occurrence = {
        apontamentoId: entry.id,
        projetoId: project.id,
        projeto: project.nome,
        colaboradorId: entry.colaboradorId,
        colaborador: entry.colaborador.nomeCompleto || "Colaborador",
        data: day,
      };
      if (cost.semVinculo) {
        vinculosAusentes.push(occurrence);
        occurrences.push({
          ...occurrence,
          tipo: "SEM_VINCULO",
          descricao: "Sem participação de equipe válida na data das horas.",
        });
      }
      if (cost.semCusto) {
        horasSemCusto += Number(entry.horas);
        registrosSemCusto++;
        occurrences.push({
          ...occurrence,
          tipo: "SEM_REMUNERACAO",
          descricao: "Sem valor/hora preservado vigente na data das horas.",
        });
      }
      if (!entry.tarefaId)
        occurrences.push({
          ...occurrence,
          tipo: "SEM_TAREFA",
          descricao: "Apontamento sem tarefa; classificação de correção desconhecida.",
        });
      custoBase += cost.custoBase;
      bonificacao += cost.bonificacao;
      const mes = day.slice(0, 7);
      if (!meses.has(mes))
        meses.set(mes, { mes, apontamentos: 0, horas: 0, custoBase: 0, bonificacao: 0 });
      for (const serie of [meses.get(mes), porStatus.get(entry.status)].filter(Boolean)) {
        serie.apontamentos++;
        serie.horas += Number(entry.horas);
        serie.custoBase += cost.custoBase;
        serie.bonificacao += cost.bonificacao;
      }
    }
    const horas = sum(project.apontamentos, "horas");
    const orcamento = Number(project.valorProjeto);
    const custo = round(round(custoBase) + round(bonificacao));
    // Fórmula adotada pelo sistema: orçado / realizado × 100, inclusive acima de 100%.
    // Não comparar orçamento integral com custo de apenas parte do período/equipe.
    const assertividade =
      !period &&
      !filters.equipe &&
      !filters.colaboradorId &&
      !filters.sprintId &&
      !filters.statusApontamentos?.length &&
      horas > 0 &&
      !registrosSemCusto &&
      orcamento > 0 &&
      custo > 0
        ? round((orcamento / custo) * 100)
        : null;
    return {
      id: project.id,
      nome: project.nome,
      status: project.status,
      clienteId: project.clienteId,
      cliente: project.cliente.nome,
      horas,
      custo,
      custoBase: round(custoBase),
      bonificacao: round(bonificacao),
      registrosSemVinculo: vinculosAusentes.length,
      vinculosAusentes,
      orcamento,
      horasSemCusto: round(horasSemCusto),
      inconsistencias: registrosSemCusto + vinculosAusentes.length,
      assertividade,
      operacionais: operationalIndicators([project], filters).indicadores,
    };
  });
  const clients = new Map();
  for (const row of rows) {
    if (!clients.has(row.clienteId))
      clients.set(row.clienteId, {
        id: row.clienteId,
        nome: row.cliente,
        projetos: 0,
        horas: 0,
        custo: 0,
        custoBase: 0,
        bonificacao: 0,
        horasSemCusto: 0,
      });
    const client = clients.get(row.clienteId);
    client.projetos++;
    for (const key of ["horas", "custo", "custoBase", "bonificacao", "horasSemCusto"])
      client[key] = round(client[key] + row[key]);
  }
  const comparable = rows.filter((row) => row.assertividade !== null);
  // Consolidação escolhida para a interface: média aritmética dos projetos elegíveis.
  const assertividade = comparable.length
    ? round(sum(comparable, "assertividade") / comparable.length)
    : null;
  const operational = operationalIndicators(visible, filters);
  occurrences.push(...operational.ocorrencias);
  const detailedOccurrences = occurrences.map((row, index) => ({
    ...row,
    chave: `${row.tipo}:${row.projetoId}:${row.tarefaId ?? row.apontamentoId ?? index}`,
  }));
  return {
    resumo: {
      projetos: rows.length,
      projetosAtivos: rows.filter((p) => p.status === "ATIVO").length,
      clientes: clients.size,
      custo: sum(rows, "custo"),
      horas: sum(rows, "horas"),
      custoBase: sum(rows, "custoBase"),
      bonificacao: sum(rows, "bonificacao"),
      registrosSemVinculo: sum(rows, "registrosSemVinculo"),
      vinculosAusentes: rows.flatMap((row) => row.vinculosAusentes),
      horasSemCusto: sum(rows, "horasSemCusto"),
      inconsistencias: sum(rows, "inconsistencias"),
      assertividade,
      projetosComAssertividade: comparable.length,
      ...operational.indicadores,
      totalOcorrencias: detailedOccurrences.length,
      ocorrenciasOperacionais: detailedOccurrences.filter(
        (row) => !["SEM_REMUNERACAO", "SEM_VINCULO"].includes(row.tipo),
      ).length,
    },
    projetos: rows,
    ocorrencias: detailedOccurrences,
    tarefas: operational.tarefas,
    equipes: fecharEquipes(equipes),
    rankingInconsistencias: rankingDeInconsistencias(rows, detailedOccurrences),
    auditoria: [...rows].sort(
      (a, b) =>
        (a.assertividade ?? Infinity) - (b.assertividade ?? Infinity) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    ),
    clientes: [...clients.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    evolucao: fecharSeries([...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes))),
    apontamentosPorStatus: fecharSeries([...porStatus.values()]),
  };
}

const STATUS_APONTAMENTO = ["PENDENTE", "APROVADO", "FATURADO"];

/** Arredonda as somas de cada ponto das séries e acrescenta o custo total. */
function fecharSeries(series) {
  return series.map((row) => {
    const custoBase = round(row.custoBase);
    const bonificacao = round(row.bonificacao);
    return {
      ...row,
      horas: round(row.horas),
      custoBase,
      bonificacao,
      custo: round(custoBase + bonificacao),
    };
  });
}

/**
 * Uma sprint pertence a um único projeto. Escolhê-la junto de projetos que não são o dela
 * esvaziaria o recorte sem explicação, então a combinação é recusada.
 */
async function conferirRecorte(filters) {
  if (!filters.sprintId) return;
  const sprint = await dashboardRepository.findSprint(filters.sprintId);
  if (!sprint) throw new HttpError(400, "Sprint não encontrada.");
  if (filters.projetoIds?.length && !filters.projetoIds.includes(sprint.projetoId))
    throw new HttpError(400, "A sprint escolhida não pertence aos projetos selecionados.");
}

export const dashboardService = {
  // [SERVICE] Dashboard Geral com os filtros da tela.
  async get(filters) {
    await conferirRecorte(filters);
    const [projects, bonuses] = await Promise.all([
      dashboardRepository.load(filters),
      bonificacoesPapeisRepository.findAll(),
    ]);
    return summarizeDashboard(projects, filters, bonuses);
  },
  // [SERVICE] Dashboard de um projeto, com a evolução mensal.
  async project(id, filters = {}) {
    const project = await dashboardRepository.findProject(id);
    if (!project) throw new HttpError(404, "Projeto não encontrado.");
    // O próprio projeto da tela prevalece sobre qualquer outro projeto informado.
    const { projetoId: _projetoId, ...resto } = filters;
    const scoped = { ...resto, projetoIds: [id] };
    await conferirRecorte(scoped);
    const [projects, bonuses] = await Promise.all([
      dashboardRepository.load(scoped),
      bonificacoesPapeisRepository.findAll(),
    ]);
    const dashboard = summarizeDashboard(projects, scoped, bonuses);
    const detalhes = detailRows(projects, scoped, bonuses);
    return {
      ...dashboard,
      tipo: "projeto",
      projeto: project,
      ...detalhes,
      evolucao: evolucaoMensal(detalhes.apontamentos, project.valorProjeto),
    };
  },
  // [SERVICE] Dashboard de um colaborador.
  async collaborator(id, filters = {}) {
    const collaborator = await dashboardRepository.findCollaborator(id);
    if (!collaborator) throw new HttpError(404, "Colaborador não encontrado.");
    const scoped = { ...filters, colaboradorId: id };
    await conferirRecorte(scoped);
    const [projects, bonuses] = await Promise.all([
      dashboardRepository.load(scoped),
      bonificacoesPapeisRepository.findAll(),
    ]);
    const dashboard = summarizeDashboard(projects, scoped, bonuses);
    return {
      ...dashboard,
      tipo: "colaborador",
      colaborador: collaborator,
      ...detailRows(projects, scoped, bonuses),
    };
  },
  options() {
    return dashboardRepository.options();
  },
  // Mesmo recorte do dashboard geral, com uma linha por apontamento para o relatório em Excel.
  async report(filters = {}) {
    await conferirRecorte(filters);
    const [projects, bonuses, nomesFiltros] = await Promise.all([
      dashboardRepository.load(filters),
      bonificacoesPapeisRepository.findAll(),
      dashboardRepository.filterNames(filters),
    ]);
    return {
      ...summarizeDashboard(projects, filters, bonuses),
      apontamentos: reportEntries(projects, bonuses),
      filtros: filters,
      nomesFiltros,
    };
  },
};

export function reportEntries(projects, bonuses) {
  return projects
    .flatMap((project) =>
      project.apontamentos.map((entry) => {
        const cost = entryCost(entry, project, bonuses);
        return {
          id: entry.id,
          data: dayOf(entry.data),
          clienteId: project.clienteId,
          cliente: project.cliente.nome,
          projetoId: project.id,
          projeto: project.nome,
          tarefaId: entry.tarefaId,
          tarefa: project.tarefas?.find((task) => task.id === entry.tarefaId)?.titulo ?? null,
          colaboradorId: entry.colaboradorId,
          colaborador: entry.colaborador.nomeCompleto,
          email: entry.colaborador.email ?? null,
          departamento: entry.colaborador.departamento ?? null,
          cargo: entry.colaborador.cargo ?? null,
          horas: Number(entry.horas),
          status: entry.status,
          descricao: entry.descricao,
          ...cost,
        };
      }),
    )
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
}

/**
 * Horas e custo por mês dos apontamentos do recorte, com o custo acumulado e quanto ele
 * representa do orçamento integral. Com período, o acumulado começa no início do período.
 */
// [REGRA] Custo por mês, custo acumulado e percentual do orçamento (gráfico Evolução).
export function evolucaoMensal(apontamentos, valorProjeto) {
  const meses = new Map();
  for (const entry of apontamentos) {
    const mes = dayOf(entry.data).slice(0, 7);
    if (!meses.has(mes))
      meses.set(mes, { mes, horas: 0, custoBase: 0, bonificacao: 0, apontamentos: 0 });
    const row = meses.get(mes);
    row.horas += entry.horas;
    row.custoBase += entry.custoBase;
    row.bonificacao += entry.bonificacao;
    row.apontamentos++;
  }
  const orcamento = Number(valorProjeto);
  let acumulado = 0;
  return [...meses.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((row) => {
      const custoBase = round(row.custoBase);
      const bonificacao = round(row.bonificacao);
      const custo = round(custoBase + bonificacao);
      acumulado = round(acumulado + custo);
      return {
        ...row,
        horas: round(row.horas),
        custoBase,
        bonificacao,
        custo,
        custoAcumulado: acumulado,
        percentualOrcamento: orcamento > 0 ? round((acumulado / orcamento) * 100) : null,
      };
    });
}

function detailRows(projects, filters, bonuses) {
  const entries = projects
    .flatMap((project) =>
      project.apontamentos.map((entry) => ({
        id: entry.id,
        projetoId: project.id,
        projeto: project.nome,
        colaboradorId: entry.colaboradorId,
        colaborador: entry.colaborador.nomeCompleto,
        tarefaId: entry.tarefaId,
        tarefa: project.tarefas?.find((task) => task.id === entry.tarefaId)?.titulo ?? null,
        data: entry.data,
        horas: Number(entry.horas),
        status: entry.status,
        descricao: entry.descricao,
        ...entryCost(entry, project, bonuses),
      })),
    )
    .sort((a, b) => new Date(b.data) - new Date(a.data) || b.id - a.id);
  const contributors = new Map();
  for (const entry of entries) {
    if (!contributors.has(entry.colaboradorId))
      contributors.set(entry.colaboradorId, {
        id: entry.colaboradorId,
        nome: entry.colaborador,
        horas: 0,
        custoBase: 0,
        bonificacao: 0,
        custo: 0,
        horasSemCusto: 0,
      });
    const person = contributors.get(entry.colaboradorId);
    for (const key of ["horas", "custoBase", "bonificacao", "custo"])
      person[key] = round(person[key] + entry[key]);
    if (entry.semCusto) person.horasSemCusto = round(person.horasSemCusto + entry.horas);
  }
  const team = projects.flatMap((project) =>
    (project.equipe ?? [])
      .filter(
        (member) =>
          (!filters.colaboradorId || member.colaboradorId === filters.colaboradorId) &&
          (!filters.equipe || member.colaborador?.departamento === filters.equipe) &&
          (!filters.dataInicio ||
            !member.dataSaida ||
            dayOf(member.dataSaida) >= dayOf(filters.dataInicio)) &&
          (!filters.dataFim || dayOf(member.dataEntrada) <= dayOf(filters.dataFim)),
      )
      .map((member) => ({
        id: member.id,
        projetoId: project.id,
        projeto: project.nome,
        colaboradorId: member.colaboradorId,
        nome: member.colaborador?.nomeCompleto ?? "Colaborador",
        cargo: member.colaborador?.cargo,
        departamento: member.colaborador?.departamento,
        papel: member.papel,
        dataEntrada: member.dataEntrada,
        dataSaida: member.dataSaida,
      })),
  );
  return { apontamentos: entries, colaboradores: [...contributors.values()], equipe: team };
}
