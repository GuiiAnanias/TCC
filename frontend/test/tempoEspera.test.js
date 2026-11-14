import test from "node:test";
import assert from "node:assert/strict";
import { segundosRestantes, tempoDeEspera } from "../src/autenticacao/tempoEspera.js";

test("tempo de espera do login bloqueado aparece em segundos ou minutos", () => {
  assert.equal(tempoDeEspera(1), "1 segundo");
  assert.equal(tempoDeEspera(9), "9 segundos");
  assert.equal(tempoDeEspera(60), "1 minuto");
  assert.equal(tempoDeEspera(61), "1 minuto e 1 segundo");
  assert.equal(tempoDeEspera(299), "4 minutos e 59 segundos");
});

test("contagem regressiva arredonda para cima e não fica negativa", () => {
  assert.equal(segundosRestantes(0, 1000), 0);
  assert.equal(segundosRestantes(10500, 1000), 10);
  assert.equal(segundosRestantes(10001, 1000), 10);
  assert.equal(segundosRestantes(5000, 9000), 0);
});
