import test from "node:test";
import assert from "node:assert/strict";
import { apontamentosService } from "../src/services/apontamentosService.js";
import { apontamentosRepository } from "../src/repositories/apontamentosRepository.js";
import { colaboradoresRepository } from "../src/repositories/colaboradoresRepository.js";
import { projetosRepository } from "../src/repositories/projetosRepository.js";
import { todayFinanceDate } from "../src/utils/financeDates.js";

const day = (offset) => new Date(todayFinanceDate().getTime() + offset * 86400000);
const existente = { id: 9, colaboradorId: 2, projetoId: 1, tarefaId: null, data: day(-3), horas: "6", status: "PENDENTE", descricao: "Desenvolvimento" };

async function withRepositories({ horasNoDia = 0, record = existente } = {}, run) {
  const originals = [apontamentosRepository, colaboradoresRepository, projetosRepository].map((repo) => ({ ...repo }));
  const calls = { sums: [], writes: [] };
  apontamentosRepository.findById = async () => ({ ...record });
  apontamentosRepository.sumHorasNoDia = async (...args) => { calls.sums.push(args); return horasNoDia; };
  apontamentosRepository.create = async (data) => { calls.writes.push(data); return { id: 10, ...data }; };
  apontamentosRepository.update = async (id, data) => { calls.writes.push(data); return { ...record, ...data }; };
  colaboradoresRepository.findById = async (id) => ({ id, status: "ATIVO" });
  projetosRepository.findById = async (id) => ({ id, status: "ATIVO" });
  try { await run(calls); } finally {
    [apontamentosRepository, colaboradoresRepository, projetosRepository].forEach((repo, index) => Object.assign(repo, originals[index]));
  }
}

const novo = (data, horas = 4) => ({ colaboradorId: 2, projetoId: 1, data, horas, status: "PENDENTE", descricao: "Desenvolvimento" });

test("apontamento novo recusa data futura e aceita hoje", async () => {
  await withRepositories({}, async (calls) => {
    await assert.rejects(apontamentosService.create(novo(day(1))), { statusCode: 400 });
    await assert.rejects(apontamentosService.create(novo(new Date("2030-01-01"))), { statusCode: 400 });
    await apontamentosService.create(novo(day(0)));
    assert.equal(calls.writes.length, 1);
  });
});

test("soma do colaborador no dia não pode passar de 24 h", async () => {
  await withRepositories({ horasNoDia: 20 }, async (calls) => {
    await assert.rejects(apontamentosService.create(novo(day(-1), 4.01)), { statusCode: 400 });
    await apontamentosService.create(novo(day(-1), 4));
    assert.equal(calls.writes.length, 1);
    assert.deepEqual(calls.sums.at(-1).slice(0, 1), [2]);
  });
});

test("edição desconta o próprio apontamento da soma e recusa data futura", async () => {
  await withRepositories({ horasNoDia: 18 }, async (calls) => {
    await assert.rejects(apontamentosService.update(9, { horas: 6.5 }), { statusCode: 400 });
    await apontamentosService.update(9, { horas: 6 + 0 });
    await apontamentosService.update(9, { descricao: "Revisão" });
    assert.equal(calls.sums.length, 1);
    assert.equal(calls.sums[0][2], 9);
    await assert.rejects(apontamentosService.update(9, { data: day(2) }), { statusCode: 400 });
  });
});

test("apontamento antigo com data futura pode ser editado sem mudar a data", async () => {
  await withRepositories({ record: { ...existente, data: day(30) } }, async (calls) => {
    await apontamentosService.update(9, { data: day(30), descricao: "Ajuste" });
    await apontamentosService.update(9, { data: day(-1) });
    assert.equal(calls.writes.length, 2);
  });
});
