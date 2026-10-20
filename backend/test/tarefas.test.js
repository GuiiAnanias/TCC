import { test } from "node:test";
import assert from "node:assert/strict";
import { tarefaCreateSchema, tarefaUpdateSchema, sprintCreateSchema, sprintUpdateSchema } from "../src/schemas/tarefasSchemas.js";

test("tasks preserve absent estimates/dates and partial edits never reset status, correction or archive", () => {
  const base = { projetoId: 1, titulo: "Tarefa manual" };
  const parsed = tarefaCreateSchema.parse({ ...base, origem: "CLICKUP", externalId: "123", horasRealizadas: 999 });
  assert.equal(parsed.minutosEstimados, undefined);
  assert.equal(parsed.dataConclusao, undefined);
  assert.equal(parsed.origem, undefined);
  assert.equal(parsed.externalId, undefined);
  assert.deepEqual(tarefaUpdateSchema.parse({ titulo: "Novo título" }), { titulo: "Novo título" });
  assert.deepEqual(tarefaUpdateSchema.parse({ statusRegistro: "INATIVO" }), { statusRegistro: "INATIVO" });
  assert.deepEqual(sprintUpdateSchema.parse({ nome: "Novo nome" }), { nome: "Novo nome" });
  assert.equal(tarefaUpdateSchema.safeParse({}).success, false);
  for (const data of [{ minutosEstimados: 0 }, { minutosEstimados: 1.5 }, { minutosEstimados: -1 }, { minutosEstimados: Infinity }, { dataInicio: "2026-02-30" }, { responsavelIds: [1, 1] }, { correcao: "false" }, { dataConclusao: "2026-10-17" }, { dataInicio: "2026-10-18", dataConclusao: "2026-10-17", status: "CONCLUIDA" }]) assert.equal(tarefaCreateSchema.safeParse({ ...base, ...data }).success, false, JSON.stringify(data));
  assert.equal(tarefaCreateSchema.parse({ ...base, minutosEstimados: 127, status: "CONCLUIDA" }).minutosEstimados, 127);
  assert.equal(sprintCreateSchema.safeParse({ projetoId: 1, nome: "Sprint", dataInicio: "2026-10-18", dataFim: "2026-10-17" }).success, false);
});

