import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configuracaoFinanceiraCreateSchema,
  configuracaoFinanceiraUpdateSchema,
} from "../src/schemas/configuracoesFinanceirasSchemas.js";
import { configuracoesFinanceirasService as service } from "../src/services/configuracoesFinanceirasService.js";
import { configuracoesFinanceirasRepository as repo } from "../src/repositories/configuracoesFinanceirasRepository.js";
import { previousFinanceDay } from "../src/utils/financeDates.js";

test("financial inputs reject invalid dates and money and never accept caller-supplied frozen values", () => {
  const base = { itemTabelaId: 1, beneficios: 20, dataInicio: "2026-09-01" };
  const parsed = configuracaoFinanceiraCreateSchema.parse({
    ...base,
    valorHoraAplicado: 1,
    nivelAplicado: "Inválido",
    criadoPorId: 99,
  });
  assert.equal(parsed.valorHoraAplicado, undefined);
  assert.equal(parsed.criadoPorId, undefined);
  for (const invalid of [
    { dataInicio: "2026-02-30" },
    { beneficios: -1 },
    { beneficios: 1.001 },
    { beneficios: Infinity },
  ])
    assert.equal(
      configuracaoFinanceiraCreateSchema.safeParse({ ...base, ...invalid }).success,
      false,
    );
  assert.equal(previousFinanceDay("2026-03-01").toISOString().slice(0, 10), "2026-02-28");
  assert.equal(previousFinanceDay("2028-03-01").toISOString().slice(0, 10), "2028-02-29");
});

test("financial PUT creates a successor only with an effective date instead of overwriting existing values", async () => {
  const original = { ...repo };
  const current = { id: 5, colaboradorId: 2, itemTabelaId: 3, beneficios: 20, dataFim: null };
  const writes = [];
  repo.findById = async () => current;
  repo.replaceActive = async (data) => {
    writes.push(data);
    return { id: 6, ...data };
  };
  try {
    for (const invalid of [
      { beneficios: 30 },
      { dataInicio: new Date("2026-01-01") },
      { dataVigencia: new Date("2026-11-01"), dataFim: null },
    ])
      await assert.rejects(service.updateForColaborador(2, 5, invalid, 1), { statusCode: 409 });
    await assert.rejects(
      service.updateForColaborador(99, 5, { dataVigencia: new Date("2026-11-01") }, 1),
      { statusCode: 404 },
    );
    assert.equal(writes.length, 0);
    const data = configuracaoFinanceiraUpdateSchema.parse({
      beneficios: 30,
      dataVigencia: "2026-11-01",
      motivo: "Reajuste",
    });
    const created = await service.updateForColaborador(2, 5, data, 1);
    assert.equal(created.id, 6);
    assert.deepEqual(writes[0], {
      colaboradorId: 2,
      itemTabelaId: 3,
      beneficios: 30,
      dataInicio: new Date("2026-11-01"),
      motivo: "Reajuste",
      usuarioId: 1,
      expectedConfigId: 5,
    });
    assert.equal(current.beneficios, 20);
    current.dataFim = new Date("2026-10-31");
    await assert.rejects(service.updateForColaborador(2, 5, data, 1), { statusCode: 409 });
  } finally {
    Object.assign(repo, original);
  }
});
