import test from "node:test";
import assert from "node:assert/strict";
import {
  readRememberedLogin,
  saveRememberedLogin,
  forgetRememberedLogin,
} from "../src/auth/rememberedLogin.js";

function storage(t, value = null) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map(value === null ? [] : [["code-bi-remembered-login", value]]);
  values.set("code-bi-theme", "dark");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, next) => values.set(key, next),
      removeItem: (key) => values.delete(key),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  return values;
}

test("lembra somente o identificador e permite esquecê-lo sem apagar outras preferências", (t) => {
  const values = storage(t);
  assert.equal(readRememberedLogin(), "");
  saveRememberedLogin("  pessoa@exemplo.com  ");
  assert.equal(readRememberedLogin(), "pessoa@exemplo.com");
  assert.deepEqual([...values.keys()].sort(), ["code-bi-remembered-login", "code-bi-theme"]);
  forgetRememberedLogin();
  assert.equal(readRememberedLogin(), "");
  assert.equal(values.get("code-bi-theme"), "dark");
});

test("valores inválidos não são preenchidos nem persistidos como usuário", (t) => {
  const values = storage(t, "x".repeat(255));
  assert.equal(readRememberedLogin(), "");
  for (const value of ["", "   ", "x".repeat(255), null, { senha: "não salvar" }]) {
    saveRememberedLogin(value);
    assert.equal(readRememberedLogin(), "");
    assert.equal(values.has("code-bi-remembered-login"), false);
  }
});

test("armazenamento bloqueado não interrompe leitura, gravação ou desmarcação", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError");
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  assert.equal(readRememberedLogin(), "");
  assert.doesNotThrow(() => saveRememberedLogin("pessoa"));
  assert.doesNotThrow(forgetRememberedLogin);
});

test("falhas de quota ou acesso ao conteúdo não escapam para o formulário", (t) => {
  storage(t);
  for (const method of ["getItem", "setItem", "removeItem"])
    localStorage[method] = () => {
      throw new Error("armazenamento indisponível");
    };
  assert.equal(readRememberedLogin(), "");
  assert.doesNotThrow(() => saveRememberedLogin("pessoa"));
  assert.doesNotThrow(forgetRememberedLogin);
});
