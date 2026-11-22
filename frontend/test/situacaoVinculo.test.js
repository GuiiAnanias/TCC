import test from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../scripts/testes/dom.mjs";

const cleanup = installDom();
const { situacaoVinculo, inicioTrocaPapel, vinculoAnterior } =
  await import("../src/components/projetos/EquipeProjeto.jsx");
cleanup();

test("troca de papel futura: o vínculo atual segue ativo e o novo fica agendado", () => {
  const hoje = "2026-11-21";
  const atual = { dataEntrada: "2026-11-01", dataSaida: "2026-11-22" };
  const novo = { dataEntrada: "2026-11-23", dataSaida: null };
  assert.equal(situacaoVinculo(atual, hoje), "ATIVO");
  assert.equal(situacaoVinculo(novo, hoje), "AGENDADO");
  // Chegando a data, o novo vale e o antigo sai.
  assert.equal(situacaoVinculo(atual, "2026-11-23"), "INATIVO");
  assert.equal(situacaoVinculo(novo, "2026-11-23"), "ATIVO");
  // O último dia ainda conta como ativo.
  assert.equal(situacaoVinculo(atual, "2026-11-22"), "ATIVO");
});

test("troca de papel começa no dia seguinte à entrada e acha o papel que volta ao cancelar", () => {
  // Entrada hoje: o backend só aceita a troca a partir de amanhã.
  assert.equal(inicioTrocaPapel({ dataEntrada: "2026-11-21" }, "2026-11-21"), "2026-11-22");
  // Entrada antiga: a troca pode valer hoje.
  assert.equal(inicioTrocaPapel({ dataEntrada: "2026-09-01" }, "2026-11-21"), "2026-11-21");
  // Fim de mês.
  assert.equal(inicioTrocaPapel({ dataEntrada: "2026-11-30" }, "2026-11-21"), "2026-12-01");

  const anterior = { id: 1, colaboradorId: 7, papel: "Dev", dataSaida: "2026-11-22T00:00:00Z" };
  const agendado = { id: 2, colaboradorId: 7, papel: "QA", dataEntrada: "2026-11-23T00:00:00Z" };
  const outraPessoa = { id: 3, colaboradorId: 8, papel: "PO", dataSaida: "2026-11-22" };
  assert.equal(vinculoAnterior([outraPessoa, anterior, agendado], agendado), anterior);
  // Entrada agendada sem papel anterior.
  assert.equal(vinculoAnterior([outraPessoa, agendado], agendado), undefined);
});
