import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret-only";
const { app } = await import("../src/app.js");
const { default: prisma } = await import("../src/config/prisma.js");

test("protected API rejects missing, forged, expired and inactive sessions", async () => {
  const user = { id: 1, nomeUsuario: "admin", email: "admin@sistema.local", status: "ATIVO", senhaHash: await bcrypt.hash("admin123", 4) };
  const originalFindFirst = prisma.usuario.findFirst;
  const originalFindUnique = prisma.usuario.findUnique;
  prisma.usuario.findFirst = async ({ where }) => where.OR.some((condition) => condition.email === user.email || condition.nomeUsuario === user.nomeUsuario) ? user : null;
  prisma.usuario.findUnique = async ({ where }) => where.id === user.id ? { id: user.id, nomeUsuario: user.nomeUsuario, email: user.email, status: user.status } : null;
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = (body) => fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    for (const resource of ["dashboard/projetos/1", "dashboard/colaboradores/1", "dashboard", "dashboard/opcoes", "tarefas", "sprints", "bonificacoes-papeis", "clientes", "colaboradores", "remuneracoes", "projetos", "apontamentos", "opcoes-cadastro", "projetos/papeis", "projetos/1/equipe", "colaboradores/1/configuracoes-financeiras"]) {
      for (const method of ["GET", "POST", "PUT", "DELETE"]) {
        assert.equal((await fetch(`${base}/${resource}`, { method })).status, 401, `${method} ${resource}`);
      }
    }
    assert.equal((await login({ login: "admin", senha: "wrong" })).status, 401);
    assert.equal((await login({ login: "unknown", senha: "admin123" })).status, 401);
    assert.equal((await login({})).status, 400);
    let validToken;
    for (const identifier of ["admin", "admin@sistema.local"]) {
      const result = await login({ login: identifier, senha: "admin123" });
      assert.equal(result.status, 200);
      const data = await result.json();
      validToken = data.token;
      assert.equal(data.user.senhaHash, undefined);
      const me = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } });
      assert.equal(me.status, 200);
      const profile = (await me.json()).user;
      assert.equal(profile.nomeUsuario, "admin");
      assert.equal(profile.senhaHash, undefined);
      assert.equal(profile.resetToken, undefined);
    }
    const optionsResponse = await fetch(`${base}/opcoes-cadastro`, { headers: { Authorization: `Bearer ${validToken}` } });
    assert.equal(optionsResponse.status, 200);
    const options = await optionsResponse.json();
    assert.ok(options.cargos.includes("Desenvolvedor Front-end"));
    assert.ok(options.niveisRemuneracao.includes("Júnior II"));
    assert.ok(options.papeisProjeto.includes("Dev"));
    assert.equal(options.niveisRemuneracao.includes("QA"), false);
    assert.deepEqual(options.funcoes, options.cargos);
    const rolesResponse = await fetch(`${base}/projetos/papeis`, { headers: { Authorization: `Bearer ${validToken}` } });
    assert.equal(rolesResponse.status, 200);
    assert.deepEqual(await rolesResponse.json(), options.papeisProjeto);
    for (const token of ["invalid", jwt.sign({}, "wrong-secret", { subject: "1" }), jwt.sign({}, process.env.JWT_SECRET, { subject: "1", expiresIn: -1 }), jwt.sign({}, process.env.JWT_SECRET, { subject: "999" }), jwt.sign({}, process.env.JWT_SECRET, { subject: "bad" })]) {
      assert.equal((await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
      assert.equal((await fetch(`${base}/clientes`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    }
    user.status = "INATIVO";
    assert.equal((await login({ login: "admin", senha: "admin123" })).status, 401);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${validToken}` } })).status, 401);
    user.status = "ATIVO";
    assert.equal((await fetch(`${base}/auth/register`, { method: "POST", headers: { Authorization: `Bearer ${validToken}` } })).status, 404);
  } finally {
    prisma.usuario.findFirst = originalFindFirst;
    prisma.usuario.findUnique = originalFindUnique;
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
