import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tarefaCreateSchema,
  tarefaUpdateSchema,
  sprintCreateSchema,
  sprintUpdateSchema,
} from "../src/schemas/tarefasSchemas.js";
import {
  apontamentoCreateSchema,
  apontamentoUpdateSchema,
} from "../src/schemas/apontamentosSchemas.js";
import { apontamentosService } from "../src/services/apontamentosService.js";
import { apontamentosRepository } from "../src/repositories/apontamentosRepository.js";
import { tarefasRepository } from "../src/repositories/tarefasRepository.js";
import { projetosRepository } from "../src/repositories/projetosRepository.js";
import { colaboradoresRepository } from "../src/repositories/colaboradoresRepository.js";

test("tasks preserve absent estimates/dates and partial edits never reset status, correction or archive", () => {
  const base = { projetoId: 1, titulo: "Tarefa manual" };
  const parsed = tarefaCreateSchema.parse({
    ...base,
    origem: "CLICKUP",
    externalId: "123",
    horasRealizadas: 999,
  });
  assert.equal(parsed.minutosEstimados, undefined);
  assert.equal(parsed.dataConclusao, undefined);
  assert.equal(parsed.origem, undefined);
  assert.equal(parsed.externalId, undefined);
  assert.deepEqual(tarefaUpdateSchema.parse({ titulo: "Novo título" }), { titulo: "Novo título" });
  assert.deepEqual(tarefaUpdateSchema.parse({ statusRegistro: "INATIVO" }), {
    statusRegistro: "INATIVO",
  });
  assert.deepEqual(sprintUpdateSchema.parse({ nome: "Novo nome" }), { nome: "Novo nome" });
  assert.equal(tarefaUpdateSchema.safeParse({}).success, false);
  for (const data of [
    { minutosEstimados: 0 },
    { minutosEstimados: 1.5 },
    { minutosEstimados: -1 },
    { minutosEstimados: Infinity },
    { dataInicio: "2026-02-30" },
    { responsavelIds: [1, 1] },
    { correcao: "false" },
    { dataConclusao: "2026-10-17" },
    { dataInicio: "2026-10-18", dataConclusao: "2026-10-17", status: "CONCLUIDA" },
  ])
    assert.equal(
      tarefaCreateSchema.safeParse({ ...base, ...data }).success,
      false,
      JSON.stringify(data),
    );
  assert.equal(
    tarefaCreateSchema.parse({ ...base, minutosEstimados: 127, status: "CONCLUIDA" })
      .minutosEstimados,
    127,
  );
  assert.equal(
    sprintCreateSchema.safeParse({
      projetoId: 1,
      nome: "Sprint",
      dataInicio: "2026-10-18",
      dataFim: "2026-10-17",
    }).success,
    false,
  );
});

test("time entries can remain unlinked or detach a task; finite decimal hours retain existing precision", () => {
  const base = {
    projetoId: 1,
    colaboradorId: 1,
    data: "2026-10-17",
    horas: 2.12,
    descricao: "Tempo manual",
  };
  assert.equal(apontamentoCreateSchema.parse(base).tarefaId, undefined);
  assert.deepEqual(apontamentoUpdateSchema.parse({ tarefaId: null }), { tarefaId: null });
  for (const horas of [Infinity, 0, -1, 1000, 2.123])
    assert.equal(apontamentoCreateSchema.safeParse({ ...base, horas }).success, false);
});

test("linking existing time checks the merged project and task, and updates once without creating hours", async () => {
  const originals = [
    apontamentosRepository,
    tarefasRepository,
    projetosRepository,
    colaboradoresRepository,
  ].map((repo) => ({ ...repo }));
  const writes = [];
  apontamentosRepository.transaction = async (operation) => operation();
  apontamentosRepository.findById = async () => ({
    id: 8,
    projetoId: 1,
    colaboradorId: 2,
    tarefaId: 4,
    horas: 8,
  });
  apontamentosRepository.update = async (id, data) => {
    writes.push(data);
    return { id, ...data };
  };
  apontamentosRepository.create = async () => {
    throw new Error("Não pode duplicar apontamentos");
  };
  projetosRepository.findById = async () => ({ id: 2 });
  tarefasRepository.findById = async (id) => ({
    id,
    projetoId: id === 5 ? 2 : 1,
    statusRegistro: id === 6 ? "INATIVO" : "ATIVO",
    projeto: { status: "ATIVO" },
  });
  try {
    await assert.rejects(apontamentosService.update(8, { projetoId: 2 }), { statusCode: 400 });
    await assert.rejects(apontamentosService.update(8, { tarefaId: 5 }), { statusCode: 400 });
    await assert.rejects(apontamentosService.update(8, { tarefaId: 6 }), { statusCode: 409 });
    assert.equal(writes.length, 0);
    await apontamentosService.update(8, { tarefaId: 7 });
    await apontamentosService.update(8, { projetoId: 2, tarefaId: null });
    assert.deepEqual(writes, [{ tarefaId: 7 }, { projetoId: 2, tarefaId: null }]);
  } finally {
    [
      apontamentosRepository,
      tarefasRepository,
      projetosRepository,
      colaboradoresRepository,
    ].forEach((repo, index) => Object.assign(repo, originals[index]));
  }
});
