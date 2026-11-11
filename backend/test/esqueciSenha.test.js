import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-secret-only";
const { app } = await import("../src/app.js");
const { senhaService, hashToken, MENSAGEM_SOLICITACAO } =
  await import("../src/services/senhaService.js");
const { usuariosRepository } = await import("../src/repositories/usuariosRepository.js");
const { emailService } = await import("../src/services/emailService.js");
const { limitesAutenticacaoRepository } =
  await import("../src/repositories/limitesAutenticacaoRepository.js");

const agora = new Date("2026-11-10T12:00:00.000Z");

// Banco e envio simulados: guarda o token salvo e os e-mails "enviados".
async function cenario(inicial, run) {
  const originalRepo = { ...usuariosRepository };
  const originalEnviar = emailService.enviar;
  const usuario = inicial && {
    id: 7,
    nomeUsuario: "ana",
    email: "ana@sistema.local",
    status: "ATIVO",
    resetToken: null,
    resetTokenExpiraEm: null,
    ...inicial,
  };
  const enviados = [];
  const consultas = [];
  usuariosRepository.findByEmail = async (email) => {
    consultas.push(email);
    return usuario && usuario.email.toLowerCase() === email.toLowerCase() ? { ...usuario } : null;
  };
  usuariosRepository.saveResetToken = async (id, hash, expiraEm) => {
    Object.assign(usuario, { resetToken: hash, resetTokenExpiraEm: expiraEm });
  };
  emailService.enviar = async (mensagem) => {
    enviados.push(mensagem);
  };
  try {
    await run({ usuario, enviados, consultas });
  } finally {
    Object.assign(usuariosRepository, originalRepo);
    emailService.enviar = originalEnviar;
  }
}

test("e-mail cadastrado recebe o link de uso único para a tela de redefinição", async () => {
  await cenario({}, async ({ usuario, enviados }) => {
    const enviado = await senhaService.solicitarPorEmail("ANA@sistema.local", {
      frontendUrl: "http://localhost:5173/",
      agora,
    });
    assert.equal(enviado, true);
    assert.equal(enviados.length, 1);
    const [mensagem] = enviados;
    assert.equal(mensagem.para, "ana@sistema.local");
    assert.match(mensagem.assunto, /Redefinição de senha/);
    const link = mensagem.texto.match(/http:\/\/localhost:5173\/redefinir-senha\?token=[\w-]+/)[0];
    const token = new URL(link).searchParams.get("token");
    assert.equal(usuario.resetToken, hashToken(token));
    assert.ok(!mensagem.texto.includes(usuario.resetToken), "o e-mail não leva o hash");
    assert.match(mensagem.html, /href="http:\/\/localhost:5173\/redefinir-senha\?token=/);
    assert.deepEqual(usuario.resetTokenExpiraEm, new Date(agora.getTime() + 30 * 60 * 1000));
  });
});

test("e-mail desconhecido ou de conta inativa não gera link nem envio", async () => {
  await cenario(null, async ({ enviados }) => {
    assert.equal(
      await senhaService.solicitarPorEmail("ninguem@sistema.local", { frontendUrl: "x", agora }),
      false,
    );
    assert.equal(enviados.length, 0);
  });
  await cenario({ status: "INATIVO" }, async ({ usuario, enviados }) => {
    assert.equal(
      await senhaService.solicitarPorEmail("ana@sistema.local", { frontendUrl: "x", agora }),
      false,
    );
    assert.equal(enviados.length, 0);
    assert.equal(usuario.resetToken, null);
  });
});

test("rota pública responde a mesma mensagem com ou sem cadastro e valida o e-mail", async () => {
  const originalConsume = limitesAutenticacaoRepository.consume;
  limitesAutenticacaoRepository.consume = async () => ({ allowed: true });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/esqueci-senha`;
  const post = (body) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    await cenario({}, async ({ enviados, consultas }) => {
      for (const body of [{}, { email: "" }, { email: "   " }, { email: "ana" }]) {
        const resposta = await post(body);
        assert.equal(resposta.status, 400);
        assert.match((await resposta.json()).errors[0].message, /e-mail/);
      }
      assert.equal(consultas.length, 0, "dados inválidos não consultam o banco");

      const cadastrado = await post({ email: " ana@sistema.local " });
      const desconhecido = await post({ email: "outra@sistema.local" });
      assert.equal(cadastrado.status, 200);
      assert.equal(desconhecido.status, 200);
      assert.deepEqual(await cadastrado.json(), { message: MENSAGEM_SOLICITACAO });
      assert.deepEqual(await desconhecido.json(), { message: MENSAGEM_SOLICITACAO });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.deepEqual(consultas, ["ana@sistema.local", "outra@sistema.local"]);
      assert.equal(enviados.length, 1);
    });
  } finally {
    limitesAutenticacaoRepository.consume = originalConsume;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("falha no envio não muda a resposta da rota", async () => {
  const originalConsume = limitesAutenticacaoRepository.consume;
  const originalError = console.error;
  const erros = [];
  limitesAutenticacaoRepository.consume = async () => ({ allowed: true });
  console.error = (...args) => erros.push(args.join(" "));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await cenario({}, async () => {
      emailService.enviar = async () => {
        throw new Error("SMTP indisponível");
      };
      const resposta = await fetch(
        `http://127.0.0.1:${server.address().port}/api/auth/esqueci-senha`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "ana@sistema.local" }),
        },
      );
      assert.equal(resposta.status, 200);
      assert.deepEqual(await resposta.json(), { message: MENSAGEM_SOLICITACAO });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.match(erros.join("\n"), /SMTP indisponível/);
    });
  } finally {
    console.error = originalError;
    limitesAutenticacaoRepository.consume = originalConsume;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("limite de pedidos usa o e-mail sem diferenciar maiúsculas", async () => {
  const originalConsume = limitesAutenticacaoRepository.consume;
  const chaves = new Map();
  limitesAutenticacaoRepository.consume = async (chave, limite) => {
    const usados = (chaves.get(chave) || 0) + 1;
    chaves.set(chave, usados);
    return usados > limite ? { allowed: false, retryAfter: 60 } : { allowed: true };
  };
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await cenario(null, async () => {
      const post = (email) =>
        fetch(`http://127.0.0.1:${server.address().port}/api/auth/esqueci-senha`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      const status = [];
      for (const email of ["a@b.com", "A@B.com", "a@B.COM", "A@b.com", "a@b.com", "A@B.COM"])
        status.push((await post(email)).status);
      assert.deepEqual(status, [200, 200, 200, 200, 200, 429]);
    });
  } finally {
    limitesAutenticacaoRepository.consume = originalConsume;
    await new Promise((resolve) => server.close(resolve));
  }
});
