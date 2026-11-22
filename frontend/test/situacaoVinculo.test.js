import test from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../scripts/testes/dom.mjs";

const cleanup = installDom();
const { situacaoVinculo } = await import("../src/components/projetos/EquipeProjeto.jsx");
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
