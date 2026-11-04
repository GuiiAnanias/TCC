import test from "node:test";
import assert from "node:assert/strict";
import { clearSession, revokeSession } from "../src/auth/session.js";

test("logout atrasado e falhas antigas preservam a autenticação nova", async () => {
  let token = "antigo";
  globalThis.sessionStorage = {
    getItem: () => token,
    removeItem: () => {
      token = null;
    },
  };
  let signedOut = 0;
  let failed = 0;
  for (const reject of [false, true]) {
    token = "antigo";
    const pending = Promise.withResolvers();
    const action = revokeSession(
      {
        post: (_url, _data, config) => {
          assert.equal(config.headers.Authorization, "Bearer antigo");
          return pending.promise;
        },
      },
      () => signedOut++,
      () => failed++,
    );
    token = "novo";
    if (reject) pending.reject(new Error("rede"));
    else pending.resolve();
    await action;
    assert.equal(token, "novo");
  }
  assert.equal(signedOut, 0);
  assert.equal(failed, 0);
  assert.equal(clearSession("antigo"), false);
  await revokeSession(
    { post: async () => {} },
    () => signedOut++,
    () => failed++,
  );
  assert.equal(token, null);
  assert.equal(signedOut, 1);
  token = "vigente";
  await revokeSession(
    {
      post: async () => {
        throw new Error("rede");
      },
    },
    () => signedOut++,
    () => failed++,
  );
  assert.equal(token, "vigente");
  assert.equal(failed, 1);
  delete globalThis.sessionStorage;
});

test("401 atrasado não encerra o token atual; 401 atual emite uma única expiração", async () => {
  let token = "novo";
  globalThis.sessionStorage = {
    getItem: () => token,
    removeItem: () => {
      token = null;
    },
  };
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event.type) };
  const { api } = await import("../src/api/client.js");
  const pending = Promise.withResolvers();
  const request = api.get("/auth/me", {
    headers: { Authorization: "Bearer antigo" },
    adapter: () => pending.promise,
  });
  pending.reject({
    config: { url: "/auth/me", headers: { Authorization: "Bearer antigo" } },
    response: { status: 401 },
  });
  await assert.rejects(request);
  assert.equal(token, "novo");
  assert.deepEqual(events, []);
  await assert.rejects(
    api.get("/auth/me", {
      adapter: (config) => Promise.reject({ config, response: { status: 401 } }),
    }),
  );
  assert.equal(token, null);
  assert.deepEqual(events, ["auth-expired"]);
  delete globalThis.window;
  delete globalThis.sessionStorage;
});
