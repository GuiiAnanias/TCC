import test from "node:test";
import assert from "node:assert/strict";
import { contemBusca, normalizarBusca } from "../src/utils/textoBusca.js";

test("a busca ignora maiúsculas, acentos e espaços nas pontas", () => {
  assert.equal(normalizarBusca("  Ação JOÃO "), "acao joao");
  assert.equal(contemBusca("joao", "João da Silva"), true);
  assert.equal(contemBusca("SILVA", "João da Silva"), true);
  assert.equal(contemBusca("acao", null, undefined, "Correção de ação"), true);
  assert.equal(contemBusca("maria", "João da Silva"), false);
  assert.equal(contemBusca("   ", "qualquer"), true, "Busca vazia não filtra.");
});
