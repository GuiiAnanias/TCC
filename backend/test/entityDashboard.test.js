import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardService } from "../src/services/dashboardService.js";
import { dashboardRepository } from "../src/repositories/dashboardRepository.js";
import { bonificacoesPapeisRepository } from "../src/repositories/bonificacoesPapeisRepository.js";

test("individual dashboards separate personal costs from shared task context and enforce entity scope", async () => {
  const original = { ...dashboardRepository },
    originalBonuses = bonificacoesPapeisRepository.findAll;
  const queries = [],
    date = new Date("2026-10-02");
  const person = (id) => ({
    nomeCompleto: `Pessoa ${id}`,
    departamento: "Dev",
    configuracoesFinanceiras: [
      { dataInicio: new Date("2026-01-01"), valorHoraAplicado: 50, nivelAplicado: "Júnior II" },
    ],
  });
  const entries = [2, 8].map((horas, index) => ({
    id: index + 1,
    tarefaId: 3,
    colaboradorId: index + 1,
    colaborador: person(index + 1),
    horas,
    data: date,
  }));
  const project = {
    id: 7,
    nome: "Projeto",
    clienteId: 1,
    cliente: { nome: "Cliente" },
    status: "ATIVO",
    valorProjeto: 1100,
    equipe: entries.map((row) => ({
      id: row.colaboradorId,
      colaboradorId: row.colaboradorId,
      colaborador: row.colaborador,
      papel: "Dev",
      dataEntrada: new Date("2026-01-01"),
    })),
    tarefas: [
      {
        id: 3,
        titulo: "Compartilhada",
        status: "CONCLUIDA",
        minutosEstimados: 600,
        dataInicio: date,
        dataConclusao: date,
        responsaveis: entries.map((row) => ({
          colaboradorId: row.colaboradorId,
          colaborador: row.colaborador,
        })),
        apontamentos: entries,
      },
    ],
  };
  dashboardRepository.findProject = async (id) => (id === 7 ? project : null);
  dashboardRepository.findCollaborator = async (id) => (id === 1 ? { id, ...person(id) } : null);
  dashboardRepository.load = async (filters) => {
    queries.push(filters);
    return [
      {
        ...project,
        apontamentos: entries.filter(
          (row) => !filters.colaboradorId || row.colaboradorId === filters.colaboradorId,
        ),
      },
    ];
  };
  bonificacoesPapeisRepository.findAll = async () => [
    { papel: "Dev", percentual: 10, dataInicio: new Date("2026-01-01") },
  ];
  try {
    const whole = await dashboardService.project(7, { projetoId: 99, projetoIds: [98, 99] });
    assert.deepEqual(queries[0].projetoIds, [7]);
    assert.equal(queries[0].projetoId, undefined);
    assert.equal(whole.resumo.horas, 10);
    assert.equal(whole.resumo.custo, 550);
    assert.equal(
      whole.colaboradores.reduce((sum, row) => sum + row.custo, 0),
      550,
    );
    const own = await dashboardService.collaborator(1, { colaboradorId: 99, projetoId: 7 });
    assert.equal(queries[1].colaboradorId, 1);
    assert.equal(own.apontamentos.length, 1);
    assert.equal(own.resumo.horas, 2);
    assert.equal(own.resumo.custo, 110);
    assert.equal(own.resumo.assertividade, null);
    assert.equal(own.resumo.assertividadeTarefasContexto, 100);
    assert.equal(own.tarefas[0].horasTotais, 10);
    assert.equal(own.tarefas[0].horasNoRecorte, 2);
    assert.equal(own.equipe.length, 1);
    await assert.rejects(dashboardService.project(999), { statusCode: 404 });
    await assert.rejects(dashboardService.collaborator(999), { statusCode: 404 });
  } finally {
    Object.assign(dashboardRepository, original);
    bonificacoesPapeisRepository.findAll = originalBonuses;
  }
});
