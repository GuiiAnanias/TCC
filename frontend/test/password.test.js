import test from "node:test";
import assert from "node:assert/strict";
import { newPasswordError, passwordRules } from "../src/auth/password.js";

test("o formulário valida o tamanho em bytes sem truncar a senha", () => {
  // "A1!" cumpre maiúscula, número e símbolo; o restante testa o limite de 72 bytes.
  for (const value of [
    "A1!" + "a".repeat(69),
    "A1!" + "é".repeat(34) + "a",
    "A1!" + "🔒".repeat(17),
  ])
    assert.equal(newPasswordError(value), "");
  for (const value of ["A1!" + "a".repeat(70), "A1!" + "é".repeat(35), "A1!" + "🔒".repeat(18)])
    assert.match(newPasswordError(value), /72 bytes/);
});

test("a nova senha exige tamanho, letra maiúscula, número e símbolo", () => {
  assert.match(newPasswordError("Ab1!xyz"), /8 caracteres/);
  assert.match(newPasswordError("senha#123"), /letra maiúscula/);
  assert.match(newPasswordError("Senha#abc"), /número/);
  assert.match(newPasswordError("Senha1234"), /símbolo/);
  assert.match(newPasswordError("Senha 1234"), /símbolo/);
  for (const value of ["Senha#123", "Ação@2026", "Sénior_1x", "Chave🔒12"])
    assert.equal(newPasswordError(value), "", value);
});

test("cada regra do checklist é avaliada separadamente", () => {
  const marcadas = (value) => passwordRules.filter((rule) => rule.test(value)).map((r) => r.key);
  assert.deepEqual(marcadas(""), []);
  assert.deepEqual(marcadas("S"), ["maiuscula"]);
  assert.deepEqual(marcadas("Senha1"), ["maiuscula", "numero"]);
  assert.deepEqual(marcadas("Senha1!x"), ["tamanho", "maiuscula", "numero", "simbolo"]);
});
