import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

process.env.JWT_SECRET = "test-secret-only";
const { app } = await import("../src/app.js");
const { senhaService, hashToken, VALIDADE_LINK_MINUTOS } =
  await import("../src/services/senhaService.js");
const { usuariosRepository } = await import("../src/repositories/usuariosRepository.js");

const agora = new Date("2026-10-22T12:00:00.000Z");
const minutos = (n) => new Date(agora.getTime() + n * 60 * 1000);
const tokenDo = (link) => new URL(link).searchParams.get("token");

async function comUsuario(inicial, run) {
  const original = { ...usuariosRepository };
  const usuario = {
    id: 1,
    nomeUsuario: "admin",
    email: "admin@sistema.local",
    status: "ATIVO",
    senhaHash: "antiga",
    resetToken: null,
    resetTokenExpiraEm: null,
    ...inicial,
  };
  usuariosRepository.findByLogin = async (login) =>
    [usuario.nomeUsuario, usuario.email].includes(login) ? { ...usuario } : null;
  usuariosRepository.findByResetToken = async (hash) =>
    usuario.resetToken === hash ? { ...usuario } : null;
  usuariosRepository.saveResetToken = async (id, hash, expiraEm) => {
    Object.assign(usuario, { resetToken: hash, resetTokenExpiraEm: expiraEm });
  };
  usuariosRepository.consumeResetToken = async (id, hash, senhaHash, quando) => {
    if (usuario.resetToken !== hash || !(usuario.resetTokenExpiraEm > quando)) return false;
    Object.assign(usuario, { senhaHash, resetToken: null, resetTokenExpiraEm: null });
    return true;
  };
  try {
    await run(usuario);
  } finally {
    Object.assign(usuariosRepository, original);
  }
}

test("link de redefinição guarda só o hash do token e vale 30 minutos", async () => {
  await comUsuario({}, async (usuario) => {
    const resultado = await senhaService.gerarLink("admin@sistema.local", {
      frontendUrl: "http://localhost:5173/",
      agora,
    });
    assert.match(resultado.link, /^http:\/\/localhost:5173\/redefinir-senha\?token=[\w-]{40,}$/);
    const token = tokenDo(resultado.link);
    assert.equal(usuario.resetToken, hashToken(token));
    assert.notEqual(usuario.resetToken, token);
    assert.deepEqual(resultado.expiraEm, minutos(VALIDADE_LINK_MINUTOS));
  });
});

test("o link troca a senha uma única vez", async () => {
  await comUsuario({}, async (usuario) => {
    const token = tokenDo(
      (await senhaService.gerarLink("admin", { frontendUrl: "http://localhost:5173", agora })).link,
    );
    await senhaService.redefinir(token, "novaSenha123", minutos(5));
    assert.equal(await bcrypt.compare("novaSenha123", usuario.senhaHash), true);
    assert.equal(usuario.resetToken, null);
    await assert.rejects(senhaService.redefinir(token, "outraSenha123", minutos(6)), {
      statusCode: 400,
    });
  });
});

test("link expirado, desconhecido ou de usuário inativo é recusado", async () => {
  await comUsuario({}, async (usuario) => {
    const token = tokenDo(
      (await senhaService.gerarLink("admin", { frontendUrl: "http://localhost:5173", agora })).link,
    );
    await assert.rejects(
      senhaService.redefinir(token, "novaSenha123", minutos(VALIDADE_LINK_MINUTOS + 1)),
      { statusCode: 400 },
    );
    await assert.rejects(
      senhaService.redefinir("token-que-nao-existe-0123456789", "novaSenha123", minutos(1)),
      { statusCode: 400 },
    );
    assert.equal(usuario.senhaHash, "antiga");
  });
  await comUsuario({ status: "INATIVO" }, async (usuario) => {
    await assert.rejects(
      senhaService.gerarLink("admin", { frontendUrl: "http://localhost:5173", agora }),
      { statusCode: 409 },
    );
    usuario.resetToken = hashToken("token-antigo-de-usuario-inativo");
    usuario.resetTokenExpiraEm = minutos(10);
    await assert.rejects(
      senhaService.redefinir("token-antigo-de-usuario-inativo", "novaSenha123", minutos(1)),
      { statusCode: 400 },
    );
  });
  await comUsuario({}, async () => {
    await assert.rejects(
      senhaService.gerarLink("ninguem", { frontendUrl: "http://localhost:5173", agora }),
      { statusCode: 404 },
    );
  });
});

test("rota de redefinição é pública e valida o corpo antes de consultar o banco", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/redefinir-senha`;
  const post = (body) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post({})).status, 400);
    const curta = await post({ token: "x".repeat(43), novaSenha: "1234567" });
    assert.equal(curta.status, 400);
    assert.match((await curta.json()).errors[0].message, /8 caracteres/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
