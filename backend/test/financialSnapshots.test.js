import { test } from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { configuracoesFinanceirasRepository as repository } from "../src/repositories/configuracoesFinanceirasRepository.js";

test("financial versions freeze rate and level and close the predecessor on the previous day", async () => {
  const original = prisma.$transaction;
  const rate = { id: 1, nivel: "Júnior II", valorHora: 45, status: "ATIVO" };
  const history = [];
  const closures = [];
  prisma.$transaction = async (operation) => operation({
    $queryRaw: async () => [{ id: 1 }],
    colaborador: { findUnique: async () => ({ id: 1, status: "ATIVO" }) },
    itemTabelaRemuneracao: { findUnique: async () => rate },
    apontamentoHora: { findFirst: async () => null },
    configuracaoFinanceira: {
      findFirst: async () => history.at(-1) ?? null,
      findMany: async () => [...history].reverse(),
      update: async ({ where, data }) => { closures.push(data); const previous = history.find((row) => row.id === where.id); Object.assign(previous, data); return previous; },
      create: async ({ data }) => { const row = { id: history.length + 1, ...data }; history.push(row); return row; }
    }
  });
  try {
    const first = await repository.replaceActive({ colaboradorId: 1, itemTabelaId: 1, beneficios: 0, dataInicio: new Date("2026-09-01") });
    rate.valorHora = 90; rate.nivel = "Pleno I";
    assert.equal(first.valorHoraAplicado, 45);
    assert.equal(first.nivelAplicado, "Júnior II");
    const second = await repository.replaceActive({ colaboradorId: 1, itemTabelaId: 1, beneficios: 10, dataInicio: new Date("2026-09-02") });
    assert.equal(second.valorHoraAplicado, 90);
    assert.equal(second.nivelAplicado, "Pleno I");
    assert.equal(second.anteriorId, first.id);
    assert.equal(closures[0].dataFim.toISOString().slice(0, 10), "2026-09-01");
    assert.equal(first.valorHoraAplicado, 45);
  } finally { prisma.$transaction = original; }
});
