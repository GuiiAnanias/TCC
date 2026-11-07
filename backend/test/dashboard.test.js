import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeDashboard,
  dashboardService,
  evolucaoMensal,
} from "../src/services/dashboardService.js";
import { dashboardQuerySchema } from "../src/schemas/dashboardSchemas.js";
import { dashboardRepository } from "../src/repositories/dashboardRepository.js";
import { bonificacoesPapeisRepository } from "../src/repositories/bonificacoesPapeisRepository.js";
import prisma from "../src/config/prisma.js";

const role = "Desenvolvedor Full Stack";
const bonus = (papel = role, percentual = 0, dataInicio = "2020-01-01", dataFim = null) => ({
  papel,
  percentual,
  dataInicio: new Date(dataInicio),
  dataFim: dataFim ? new Date(dataFim) : null,
});
const config = (start, end, rate) => ({
  dataInicio: new Date(start),
  dataFim: end ? new Date(end) : null,
  valorHoraAplicado: rate,
  nivelAplicado: "Júnior II",
  itemTabela: { valorHora: rate, bonificacao: 99, tipoBonificacao: "PERCENTUAL" },
});
const member = (papel = role, start = "2020-01-01", end = null, colaboradorId = 1) => ({
  papel,
  colaboradorId,
  dataEntrada: new Date(start),
  dataSaida: end ? new Date(end) : null,
});
const entry = (
  hours,
  day = "2026-10-02",
  configs = [config("2026-01-01", null, "100")],
  colaboradorId = 1,
) => ({
  horas: hours,
  data: new Date(day),
  colaboradorId,
  colaborador: { configuracoesFinanceiras: configs },
});
const project = (id, entries = [], extra = {}) => ({
  id,
  nome: `Projeto ${id}`,
  status: "ATIVO",
  clienteId: 1,
  cliente: { nome: "Cliente A" },
  valorProjeto: "500",
  apontamentos: entries,
  equipe: [member()],
  ...extra,
});
// Zero é explicitamente cadastrado nos cenários que não possuem bonificação.
const summarize = (projects, filters = {}, bonuses = [bonus()]) =>
  summarizeDashboard(projects, filters, bonuses);

test("unfiltered overview includes inactive and empty projects, all hours and distinct clients", () => {
  const result = summarize([
    project(1, [entry("2.5"), entry("1.5")]),
    project(2, [entry("6")], { status: "ENCERRADO", clienteId: 2, cliente: { nome: "Cliente B" } }),
    project(3),
  ]);
  assert.equal(result.resumo.projetos, 3);
  assert.equal(result.resumo.projetosAtivos, 2);
  assert.equal(result.resumo.clientes, 2);
  assert.equal(result.resumo.horas, 10);
  assert.equal(result.resumo.custo, 1000);
  assert.equal(result.clientes[0].projetos, 2);
  assert.equal(result.clientes[0].custo, 400);
  assert.equal(result.auditoria[0].id, 2);
  assert.equal(result.auditoria[2].assertividade, null);
  assert.equal(result.resumo.assertividade, 104.17);
});

test("resumo por equipe soma cada apontamento uma vez, por departamento, e fecha com o total", () => {
  const pessoa = (horas, colaboradorId, departamento, extra = {}) => ({
    ...entry(horas, "2026-10-02", [config("2026-01-01", null, "100")], colaboradorId),
    colaborador: {
      departamento,
      configuracoesFinanceiras: [config("2026-01-01", null, "100")],
    },
    tarefaId: 9,
    ...extra,
  });
  const semValor = {
    ...entry("1", "2026-10-02", [], 3),
    colaborador: { departamento: null, configuracoesFinanceiras: [] },
    tarefaId: 9,
  };
  const result = summarize([
    project(1, [pessoa("2", 1, "TI"), pessoa("3", 2, "Design", { tarefaId: null }), semValor]),
    project(2, [pessoa("4", 1, "TI")]),
  ]);
  assert.deepEqual(
    result.equipes.map(({ equipe, colaboradores, projetos, horas, custo, pendencias }) => ({
      equipe,
      colaboradores,
      projetos,
      horas,
      custo,
      pendencias,
    })),
    [
      { equipe: "TI", colaboradores: 1, projetos: 2, horas: 6, custo: 600, pendencias: 0 },
      { equipe: "Design", colaboradores: 1, projetos: 1, horas: 3, custo: 300, pendencias: 2 },
      {
        equipe: "Sem departamento",
        colaboradores: 1,
        projetos: 1,
        horas: 1,
        custo: 0,
        pendencias: 2,
      },
    ],
  );
  assert.equal(result.equipes[2].horasSemCusto, 1);
  const total = (campo) => result.equipes.reduce((soma, row) => soma + row[campo], 0);
  assert.equal(total("horas"), result.resumo.horas, "Nenhuma hora repetida entre equipes.");
  assert.equal(total("custo"), result.resumo.custo);
});

test("ranking de inconsistências ordena os projetos pela quantidade, com a contagem por tipo", () => {
  const semVinculo = { ...entry("3", "2026-10-02", undefined, 2), tarefaId: 9 };
  const semTarefa = { ...entry("1"), tarefaId: null };
  const result = summarize([
    project(1, [{ ...entry("2"), tarefaId: 9 }]),
    project(2, [semVinculo, semTarefa]),
    project(3, [{ ...entry("1"), tarefaId: 9 }], { nome: "Alfa" }),
  ]);
  assert.deepEqual(
    result.rankingInconsistencias.map((row) => [row.nome, row.total]),
    [
      ["Projeto 2", 2],
      ["Alfa", 0],
      ["Projeto 1", 0],
    ],
    "Empate em zero segue a ordem alfabética.",
  );
  assert.equal(result.rankingInconsistencias[0].porTipo.SEM_VINCULO, 1);
  assert.equal(result.rankingInconsistencias[0].porTipo.SEM_TAREFA, 1);
  assert.equal(
    result.rankingInconsistencias.reduce((soma, row) => soma + row.total, 0),
    result.ocorrencias.length,
  );
  assert.equal(result.auditoria[0].id, 2, "O ranking de assertividade continua separado.");
});

test("a evolução mensal do projeto acumula o custo e compara com o orçamento integral", () => {
  const linha = (data, horas, custoBase, bonificacao = 0) => ({
    data: new Date(data),
    horas,
    custoBase,
    bonificacao,
  });
  const meses = evolucaoMensal(
    [linha("2026-10-05", 2, 200, 20), linha("2026-09-10", 4, 400), linha("2026-09-30", 1.5, 150)],
    "1000",
  );
  assert.deepEqual(
    meses.map(({ mes, horas, custo, custoAcumulado, percentualOrcamento, apontamentos }) => ({
      mes,
      horas,
      custo,
      custoAcumulado,
      percentualOrcamento,
      apontamentos,
    })),
    [
      {
        mes: "2026-09",
        horas: 5.5,
        custo: 550,
        custoAcumulado: 550,
        percentualOrcamento: 55,
        apontamentos: 2,
      },
      {
        mes: "2026-10",
        horas: 2,
        custo: 220,
        custoAcumulado: 770,
        percentualOrcamento: 77,
        apontamentos: 1,
      },
    ],
  );
  assert.equal(evolucaoMensal([linha("2026-09-10", 1, 10)], "0")[0].percentualOrcamento, null);
  assert.deepEqual(evolucaoMensal([], "1000"), []);
});

test("cost uses historical hourly rates and missing remuneration never fabricates costs or task metrics", () => {
  const configs = [config("2026-10-01", null, "100"), config("2026-01-01", "2026-09-30", "50")];
  const result = summarize([
    project(1, [
      entry("2", "2026-09-30", configs),
      entry("3", "2026-10-01", configs),
      entry("1", "2025-12-31", configs),
    ]),
  ]);
  assert.equal(result.resumo.custo, 400);
  assert.equal(result.resumo.horasSemCusto, 1);
  assert.equal(result.resumo.inconsistencias, 1);
  assert.equal(result.resumo.assertividade, null);
  for (const key of [
    "percentualCorrecoes",
    "assertividadeEstimativas",
    "percentualTarefasSemHoras",
    "percentualTarefasSemEstimativa",
  ])
    assert.equal(result.resumo[key], null);
});

test("editing the remuneration table cannot change the rate preserved in a financial configuration", () => {
  const frozen = config("2026-09-01", null, 45);
  frozen.itemTabela.valorHora = 90;
  const result = summarize([project(1, [entry(8, "2026-09-01", [frozen])])]);
  assert.equal(result.resumo.custo, 360);
  assert.equal(result.resumo.horasSemCusto, 0);
  delete frozen.valorHoraAplicado;
  const missing = summarize([project(1, [entry(8, "2026-09-01", [frozen])])]);
  assert.equal(missing.resumo.custo, 0);
  assert.equal(missing.resumo.horasSemCusto, 8);
});

test("legacy configurations with equal starting dates use the highest ID deterministically", () => {
  const older = { ...config("2026-09-01", "2026-09-30", 10), id: 1 };
  const newer = { ...config("2026-09-01", null, 45), id: 2 };
  for (const configurations of [
    [older, newer],
    [newer, older],
  ]) {
    assert.equal(
      summarize([project(1, [entry(8, "2026-09-01", configurations)])]).resumo.custo,
      360,
    );
  }
});

test("budget assertiveness divides budget by actual cost and the overview averages eligible project percentages", async () => {
  const rows = [
    project(1, [entry(1, "2026-10-02", [config("2026-01-01", null, 45)])], { valorProjeto: "1" }),
    project(2, [entry(7, "2026-10-02", [config("2026-01-01", null, 85)])], {
      valorProjeto: "12000",
    }),
  ];
  const result = summarize(rows);
  assert.equal(result.projetos[0].assertividade, 2.22);
  assert.equal(result.projetos[1].assertividade, 2016.81);
  assert.equal(result.resumo.assertividade, 1009.52);
  assert.equal(summarize([rows[0]]).resumo.assertividade, 2.22);
  assert.equal(
    summarize([project(3, [entry(8)], { valorProjeto: 1000 })]).resumo.assertividade,
    125,
  );
  const originalLoad = dashboardRepository.load;
  const originalBonuses = bonificacoesPapeisRepository.findAll;
  dashboardRepository.load = async (filters) => {
    assert.equal(filters.clienteId, 1);
    return rows;
  };
  bonificacoesPapeisRepository.findAll = async () => [bonus()];
  try {
    assert.equal(
      (await dashboardService.get({ clienteId: 1 })).resumo.assertividade,
      result.resumo.assertividade,
    );
  } finally {
    dashboardRepository.load = originalLoad;
    bonificacoesPapeisRepository.findAll = originalBonuses;
  }
});

test("half the budget produces 200%, exact match 100%, and double the budget 50%", () => {
  for (const [cost, expected] of [
    [50, 200],
    [80, 125],
    [100, 100],
    [120, 83.33],
    [150, 66.67],
    [200, 50],
  ]) {
    const result = summarize([project(1, [entry(cost / 100)], { valorProjeto: 100 })]);
    assert.equal(result.projetos[0].assertividade, expected);
    assert.equal(result.resumo.assertividade, expected);
  }
  // A razão não é simétrica: trocar orçamento e custo altera o indicador.
  assert.equal(summarize([project(1, [entry(1)], { valorProjeto: 50 })]).resumo.assertividade, 50);
});

test("budget assertiveness is unavailable without hours, positive budget or complete positive cost", () => {
  assert.equal(summarize([project(1)]).resumo.assertividade, null);
  assert.equal(summarize([project(1, [entry(1)], { valorProjeto: 0 })]).resumo.assertividade, null);
  const zeroCost = summarize([
    project(1, [entry(1, "2026-10-02", [config("2026-01-01", null, 0)])]),
  ]);
  assert.equal(zeroCost.resumo.custo, 0);
  assert.equal(zeroCost.resumo.assertividade, null);
  assert.equal(zeroCost.resumo.projetosComAssertividade, 0);
  const incomplete = summarize([project(1, [entry(1), entry(1, "2026-10-02", [])])]);
  assert.equal(incomplete.resumo.custo, 100);
  assert.equal(incomplete.resumo.assertividade, null);
  assert.equal(incomplete.resumo.projetosComAssertividade, 0);
});

test("task metrics stay unavailable even when budget assertiveness is available", () => {
  const result = summarize([project(1, [entry(1)])]);
  assert.equal(result.resumo.assertividade, 500);
  for (const key of [
    "percentualCorrecoes",
    "assertividadeEstimativas",
    "percentualTarefasSemHoras",
    "percentualTarefasSemEstimativa",
  ])
    assert.equal(result.resumo[key], null);
});

test("bonuses depend on the role in each project rather than the remuneration bracket", () => {
  const result = summarize(
    [
      project(1, [entry(10, "2026-10-02", [config("2026-01-01", null, 80)])], {
        equipe: [member("Product Owner")],
        valorProjeto: 880,
      }),
      project(2, [entry(10, "2026-10-02", [config("2026-01-01", null, 80)])], {
        equipe: [member("Scrum Master")],
        valorProjeto: 960,
      }),
    ],
    {},
    [bonus("Product Owner", 10), bonus("Scrum Master", 20)],
  );
  assert.equal(result.projetos[0].custo, 880);
  assert.equal(result.projetos[0].bonificacao, 80);
  assert.equal(result.projetos[1].custo, 960);
  assert.equal(result.projetos[1].bonificacao, 160);
  assert.equal(result.resumo.custoBase, 1600);
  assert.equal(result.resumo.bonificacao, 240);
  assert.equal(result.resumo.custo, 1840);
  assert.equal(result.clientes[0].bonificacao, 240);
  assert.equal(result.resumo.assertividade, 100);
});

test("role changes and percentage revisions preserve historical calculation, including transition dates", () => {
  const row = project(1, [entry(1, "2026-09-29"), entry(1, "2026-09-30"), entry(1, "2026-10-01")], {
    equipe: [member("Product Owner", "2026-09-30"), member(role, "2020-01-01", "2026-09-30")],
  });
  const result = summarize([row], {}, [
    bonus(role, 0),
    bonus("Product Owner", 10, "2020-01-01", "2026-10-01"),
    bonus("Product Owner", 20, "2026-10-01"),
  ]);
  assert.equal(result.resumo.custoBase, 300);
  assert.equal(result.resumo.bonificacao, 30);
  assert.equal(result.resumo.custo, 330);
});

test("bonuses are optional: absent rules and explicit zero both allow cost and assertiveness calculations", () => {
  const row = project(1, [entry(1)]);
  const unset = summarizeDashboard([row]);
  assert.equal(unset.resumo.custo, 100);
  assert.equal(unset.resumo.bonificacao, 0);
  assert.equal(unset.resumo.assertividade, 500);
  assert.equal(unset.resumo.inconsistencias, 0);
  assert.equal(unset.resumo.registrosSemVinculo, 0);
  assert.deepEqual(unset.resumo.vinculosAusentes, []);
  assert.equal(summarize([row]).resumo.assertividade, unset.resumo.assertividade);
  // Antes da primeira vigência não há bônus; isso não é erro nem bloqueio.
  const future = summarize([row], {}, [bonus(role, 10, "2026-11-01")]);
  assert.equal(future.resumo.bonificacao, 0);
  assert.equal(future.resumo.assertividade, 500);
});

test("missing membership is an actionable team notice, not a requirement to configure a bonus", () => {
  const noMembership = summarize([project(1, [{ ...entry(1), id: 123 }], { equipe: [] })], {}, [
    bonus(role, 10),
  ]);
  assert.equal(noMembership.resumo.registrosSemVinculo, 1);
  assert.equal(noMembership.resumo.inconsistencias, 1);
  assert.equal(noMembership.resumo.custo, 100);
  assert.equal(noMembership.resumo.bonificacao, 0);
  assert.equal(noMembership.resumo.assertividade, 500);
  assert.equal(noMembership.resumo.projetosComAssertividade, 1);
  assert.deepEqual(noMembership.resumo.vinculosAusentes, [
    {
      apontamentoId: 123,
      projetoId: 1,
      projeto: "Projeto 1",
      colaboradorId: 1,
      colaborador: "Colaborador",
      data: "2026-10-02",
    },
  ]);
});

test("period excludes projects without matching entries and disables partial budget comparisons", () => {
  const result = summarize([project(1, [entry(2)]), project(2)], {
    dataInicio: new Date("2026-10-01"),
  });
  assert.equal(result.resumo.projetos, 1);
  assert.equal(result.resumo.horas, 2);
  assert.equal(result.resumo.assertividade, null);
  assert.equal(summarize([project(1, [entry(2)])], { equipe: "TI" }).resumo.assertividade, null);
  const empty = summarize([]);
  assert.equal(empty.resumo.custo, 0);
  assert.equal(empty.resumo.assertividade, null);
  assert.deepEqual(empty.clientes, []);
});

test("dashboard accepts empty filters and rejects invalid dates and reverse periods", () => {
  assert.deepEqual(dashboardQuerySchema.parse({}), {});
  for (const query of [
    { dataInicio: "2026-02-30" },
    { dataFim: "ontem" },
    { clienteId: "-1" },
    { dataInicio: "2026-10-02", dataFim: "2026-10-01" },
  ])
    assert.equal(dashboardQuerySchema.safeParse(query).success, false);
  assert.equal(
    dashboardQuerySchema.parse({ dataFim: "2026-10-02" }).dataFim.toISOString(),
    "2026-10-02T00:00:00.000Z",
  );
});

test("repository applies combined filters and leaves default project and entry scopes unrestricted", async () => {
  const original = prisma.projeto.findMany;
  const queries = [];
  prisma.projeto.findMany = async (query) => {
    queries.push(query);
    return [];
  };
  try {
    await dashboardRepository.load({});
    assert.deepEqual(queries[0].where, {});
    assert.deepEqual(queries[0].include.apontamentos.where, {});
    assert.equal(queries[0].include.equipe.select.papel, true);
    const filters = dashboardQuerySchema.parse({
      clienteId: "3",
      equipe: "TI",
      dataInicio: "2026-10-01",
      dataFim: "2026-10-17",
    });
    await dashboardRepository.load(filters);
    assert.equal(queries[1].where.clienteId, 3);
    assert.equal(queries[1].where.AND[0].OR[0].equipe.some.colaborador.departamento, "TI");
    assert.equal(queries[1].include.apontamentos.where.colaborador.departamento, "TI");
    assert.deepEqual(queries[1].include.apontamentos.where.data, {
      gte: filters.dataInicio,
      lte: filters.dataFim,
    });
  } finally {
    prisma.projeto.findMany = original;
  }
});
