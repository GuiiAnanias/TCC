import { test } from "node:test";
import assert from "node:assert/strict";
import { operationalIndicators } from "../src/services/operationalIndicators.js";
import { entryCost } from "../src/services/dashboardCosts.js";

const entry = (id, tarefaId, horas, data = "2026-10-02", person = 1) => ({ id, tarefaId, horas, data: new Date(data), colaboradorId: person, colaborador: { departamento: person === 1 ? "Dev" : "QA" } });
const task = (id, minutes, entries, extra = {}) => ({ id, titulo: `Tarefa ${id}`, status: "CONCLUIDA", statusRegistro: "ATIVO", minutosEstimados: minutes, correcao: false, apontamentos: entries, responsaveis: [{ colaboradorId: 1, colaborador: { departamento: "Dev" } }], dataInicio: new Date("2026-10-01"), dataConclusao: new Date("2026-10-03"), ...extra });
const project = (tasks, entries = tasks.flatMap((task) => task.apontamentos)) => ({ id: 1, nome: "Projeto", tarefas: tasks, apontamentos: entries });

test("operational percentages use distinct tasks and ratios of totals, not means or shared-owner copies", () => {
  const tasks = [task(1, 60, [entry(1, 1, 2)], { responsaveis: [{ colaboradorId: 1 }, { colaboradorId: 2 }], correcao: true }), task(2, 540, [entry(2, 2, 3)]), task(3, 60, []), task(4, null, [], { status: "PLANEJADA" })];
  const { indicadores: result } = operationalIndicators([project(tasks)]);
  assert.equal(result.tarefas, 4);
  assert.equal(result.tarefasComparaveis, 2);
  assert.equal(result.assertividadeEstimativas, 200); // 10h / 5h; média dos percentuais seria 175%.
  assert.equal(result.percentualCorrecoes, 40);
  assert.equal(result.percentualTarefasSemHoras, 33.33);
  assert.equal(result.percentualTarefasSemEstimativa, 25);
});

test("zero is valid with a population; absent population stays null and unclassified hours mark corrections partial", () => {
  const empty = operationalIndicators([project([])]).indicadores;
  for (const key of ["assertividadeEstimativas", "percentualCorrecoes", "percentualTarefasSemHoras", "percentualTarefasSemEstimativa"]) assert.equal(empty[key], null);
  const tasks = [task(1, 60, [entry(1, 1, 1)])];
  const classified = operationalIndicators([project(tasks)]).indicadores;
  assert.equal(classified.percentualCorrecoes, 0);
  assert.equal(classified.percentualTarefasSemHoras, 0);
  const partial = operationalIndicators([project(tasks, [entry(1, 1, 1), entry(2, null, 1)])]).indicadores;
  assert.equal(partial.percentualCorrecoes, 0);
  assert.equal(partial.correcoesParciais, true);
  assert.equal(partial.horasSemTarefa, 1);
  assert.equal(operationalIndicators([project([], [entry(1, null, 1)])]).indicadores.percentualCorrecoes, null);
});

test("period comparisons exclude partial task hours and undated conclusions but retain tasks with activity", () => {
  const tasks = [task(1, 120, [entry(1, 1, 1, "2026-09-30"), entry(2, 1, 1)]), task(2, 60, [entry(3, 2, 1)]), task(3, 60, [], { dataConclusao: null }), task(4, null, [], { status: "PLANEJADA", dataInicio: null, dataConclusao: null })];
  const filters = { dataInicio: new Date("2026-10-01"), dataFim: new Date("2026-10-03") };
  const { indicadores: result, tarefas } = operationalIndicators([project(tasks, [entry(2, 1, 1), entry(3, 2, 1)])], filters);
  assert.equal(result.tarefas, 3);
  assert.equal(result.tarefasConcluidas, 2);
  assert.equal(result.tarefasComparaveis, 1);
  assert.equal(result.assertividadeEstimativas, 100);
  assert.equal(result.tarefasSemHoras, 0);
  assert.equal(tarefas.find((task) => task.id === 1).horasTotais, 2);
  assert.equal(tarefas.find((task) => task.id === 1).horasNoRecorte, 1);
});

test("individual tasks retain shared context while personal hours are never duplicated or estimated by division", () => {
  const tasks = [task(1, 600, [entry(1, 1, 2), entry(2, 1, 8, "2026-10-02", 2)])];
  const result = operationalIndicators([project(tasks, [entry(1, 1, 2)])], { colaboradorId: 1 });
  assert.equal(result.indicadores.assertividadeEstimativas, null);
  assert.equal(result.indicadores.assertividadeTarefasContexto, 100);
  assert.equal(result.tarefas[0].horasNoRecorte, 2);
  assert.equal(result.tarefas[0].horasTotais, 10);
  assert.equal(result.indicadores.horasEstimadasComparaveis, 10);
});

test("canceled tasks are excluded from planning counts; archived history and hours remain", () => {
  const tasks = [task(1, null, [entry(1, 1, 1)], { status: "CANCELADA", correcao: true }), task(2, 60, [entry(2, 2, 1)], { statusRegistro: "INATIVO" })];
  const result = operationalIndicators([project(tasks)]);
  assert.equal(result.indicadores.tarefas, 1);
  assert.equal(result.indicadores.percentualTarefasSemEstimativa, 0);
  assert.equal(result.indicadores.percentualCorrecoes, 50);
  assert.equal(result.indicadores.assertividadeEstimativas, 100);
});

test("cost components round by entry so contributor and project totals reconcile in cents", () => {
  const row = entry(1, 1, 0.03);
  row.colaborador.configuracoesFinanceiras = [{ dataInicio: new Date("2026-01-01"), valorHoraAplicado: 0.17, nivelAplicado: "Teste" }];
  const cost = entryCost(row, { equipe: [{ colaboradorId: 1, papel: "Dev", dataEntrada: new Date("2026-01-01") }] }, [{ papel: "Dev", percentual: 7.5, dataInicio: new Date("2026-01-01") }]);
  assert.equal(cost.custoBase, 0.01);
  assert.equal(cost.bonificacao, 0);
  assert.equal(cost.custo, cost.custoBase + cost.bonificacao);
});
