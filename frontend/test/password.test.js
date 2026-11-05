import test from "node:test";
import assert from "node:assert/strict";
import { newPasswordError } from "../src/auth/password.js";

test("o formulário valida o tamanho em bytes sem truncar a senha", () => {
  for (const value of ["a".repeat(72), "é".repeat(36), "🔒".repeat(18)])
    assert.equal(newPasswordError(value), "");
  for (const value of ["a".repeat(73), "é".repeat(37), "🔒".repeat(19)])
    assert.match(newPasswordError(value), /72 bytes/);
  assert.match(newPasswordError("1234567"), /8 caracteres/);
});
