import test from "node:test";
import assert from "node:assert/strict";
import { apontamentosService } from "../src/services/apontamentosService.js";
import { apontamentosRepository } from "../src/repositories/apontamentosRepository.js";

const faturado = {
  id: 9, colaboradorId: 2, projetoId: 1, tarefaId: null,
  data: new Date("2026-10-02T00:00:00.000Z"), horas: "6", status: "FATURADO", descricao: "Integração com API"
};

async function withRepository(record, run) {
  const original = { ...apontamentosRepository };
  const writes = [];
  const deleted = [];
  apontamentosRepository.transaction = async (operation) => operation();
  apontamentosRepository.findById = async () => ({ ...record });
  apontamentosRepository.update = async (id, data) => { writes.push(data); return { ...record, ...data }; };
  apontamentosRepository.delete = async (id) => { deleted.push(id); return { ...record }; };
  apontamentosRepository.sumHorasNoDia = async () => 0;
  try { await run({ writes, deleted }); } finally { Object.assign(apontamentosRepository, original); }
}

test("apontamento faturado recusa mudar horas, data, pessoa, projeto, tarefa ou descrição", async () => {
  await withRepository(faturado, async ({ writes }) => {
    for (const change of [{ horas: 99 }, { data: new Date("2026-10-03") }, { colaboradorId: 3 }, { projetoId: 2 }, { tarefaId: 4 }, { descricao: "Outra atividade" }]) {
      await assert.rejects(apontamentosService.update(9, change), { statusCode: 409 });
    }
    assert.equal(writes.length, 0);
  });
});

test("apontamento faturado pode voltar o status e aceita os mesmos valores já gravados", async () => {
  await withRepository(faturado, async ({ writes }) => {
    await apontamentosService.update(9, { status: "APROVADO" });
    await apontamentosService.update(9, { horas: 6, data: new Date("2026-10-02"), descricao: " Integração com API ", status: "APROVADO" });
    assert.equal(writes.length, 2);
  });
});

test("apontamento faturado não pode ser excluído; aprovado e pendente podem", async () => {
  await withRepository(faturado, async ({ deleted }) => {
    await assert.rejects(apontamentosService.remove(9), { statusCode: 409 });
    assert.deepEqual(deleted, []);
  });
  for (const status of ["APROVADO", "PENDENTE"]) {
    await withRepository({ ...faturado, status }, async ({ deleted }) => {
      await apontamentosService.remove(9);
      assert.deepEqual(deleted, [9]);
    });
  }
});

test("apontamento aprovado continua editável", async () => {
  await withRepository({ ...faturado, status: "APROVADO" }, async ({ writes }) => {
    await apontamentosService.update(9, { horas: 7 });
    assert.deepEqual(writes, [{ horas: 7 }]);
  });
});
