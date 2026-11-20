import test from "node:test";
import assert from "node:assert/strict";
import { novaSenhaSchema } from "../src/schemas/senhaSchemas.js";
import { senhaService } from "../src/services/senhaService.js";
import { limiteAutenticacao, tempoDeEspera } from "../src/http/middlewares/limiteAutenticacao.js";
import { limitesAutenticacaoRepository as repository } from "../src/repositories/limitesAutenticacaoRepository.js";

test("novas senhas respeitam bytes UTF-8, inclusive no serviço chamado sem HTTP", async () => {
  // "A1!" cumpre maiúscula, número e símbolo; o restante testa o limite de 72 bytes.
  for (const senha of [
    "A1!" + "a".repeat(69),
    "A1!" + "é".repeat(34) + "a",
    "A1!" + "🔒".repeat(17),
  ])
    assert.equal(novaSenhaSchema.parse(senha), senha);
  for (const senha of [
    "Ab1!xyz",
    "A1!" + "a".repeat(70),
    "A1!" + "é".repeat(35),
    "A1!" + "🔒".repeat(18),
  ]) {
    assert.equal(novaSenhaSchema.safeParse(senha).success, false);
    await assert.rejects(senhaService.redefinir("token-nao-consultado", senha), {
      name: "ZodError",
    });
  }
});

test("novas senhas exigem tamanho, letra maiúscula, número e símbolo", () => {
  const erro = (senha) => novaSenhaSchema.safeParse(senha).error?.issues[0].message;
  assert.match(erro("Ab1!xyz"), /8 caracteres/);
  assert.match(erro("senha#123"), /letra maiúscula/);
  assert.match(erro("Senha#abc"), /número/);
  assert.match(erro("Senha1234"), /símbolo/);
  assert.match(erro("Senha 1234"), /símbolo/, "espaço não conta como símbolo");
  for (const senha of ["Senha#123", "Ação@2026", "Sénior_1x", "Chave🔒12"])
    assert.equal(novaSenhaSchema.safeParse(senha).success, true, senha);
});

test("limites por origem e identificador usam chaves opacas e resposta genérica", async () => {
  const original = repository.consume;
  const counts = new Map();
  repository.consume = async (key, limit) => {
    assert.match(key, /^[a-f0-9]{64}$/);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return { allowed: count <= limit, retryAfter: 42 };
  };
  const middleware = limiteAutenticacao(
    "test",
    { originLimit: 4, identifierLimit: 2, windowMs: 900000 },
    "login",
  );
  const call = async (ip, login) => {
    const result = { headers: {} };
    const response = {
      set: (key, value) => {
        result.headers[key] = value;
      },
      status: (status) => {
        result.status = status;
        return response;
      },
      json: (body) => {
        result.body = body;
      },
    };
    await middleware({ ip, body: { login, senha: "segredo" }, socket: {} }, response, (error) => {
      if (error) throw error;
      result.status = 200;
    });
    return result;
  };
  try {
    assert.equal((await call("origem1", "Pessoa@Exemplo.local")).status, 200);
    assert.equal((await call("origem2", " pessoa@exemplo.local ")).status, 200);
    const blocked = await call("origem3", "PESSOA@EXEMPLO.LOCAL");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers["Retry-After"], "42");
    for (const id of ["a", "b", "c"]) assert.equal((await call("origem1", id)).status, 200);
    assert.deepEqual((await call("origem1", "outro")).body, blocked.body);
    assert.equal((await call("origem4", "normal")).status, 200);
    assert.ok(!JSON.stringify([...counts.keys()]).includes("pessoa"));
  } finally {
    repository.consume = original;
  }
});

test("tempo de espera do bloqueio aparece em segundos ou minutos", () => {
  assert.equal(tempoDeEspera(1), "1 segundo");
  assert.equal(tempoDeEspera(10), "10 segundos");
  assert.equal(tempoDeEspera(60), "1 minuto");
  assert.equal(tempoDeEspera(270), "4 minutos e 30 segundos");
  assert.equal(tempoDeEspera(300), "5 minutos");
});

test("no login o limite por usuário é progressivo e a resposta informa o tempo", async () => {
  const { consume, consumeProgressivo } = repository;
  const chamadas = [];
  repository.consume = async () => ({ allowed: true, retryAfter: 0 });
  repository.consumeProgressivo = async (key, limit, windowMs, bloqueiosMs) => {
    chamadas.push({ key, limit, windowMs, bloqueiosMs });
    return { allowed: false, retryAfter: 60 };
  };
  const middleware = limiteAutenticacao(
    "login",
    { originLimit: 60, identifierLimit: 10, windowMs: 900000, bloqueiosMs: [10000, 60000, 300000] },
    "login",
  );
  const result = {};
  const response = {
    set: (key, value) => (result.header = [key, value]),
    status: (status) => ((result.status = status), response),
    json: (body) => (result.body = body),
  };
  try {
    await middleware({ ip: "origem", body: { login: "admin" }, socket: {} }, response, () => {
      throw new Error("não deveria liberar");
    });
    assert.equal(chamadas.length, 1);
    assert.deepEqual(chamadas[0].bloqueiosMs, [10000, 60000, 300000]);
    assert.equal(result.status, 429);
    assert.deepEqual(result.header, ["Retry-After", "60"]);
    assert.deepEqual(result.body, {
      message: "Muitas tentativas. Tente novamente em 1 minuto.",
      tentarNovamenteEm: 60,
    });
  } finally {
    repository.consume = consume;
    repository.consumeProgressivo = consumeProgressivo;
  }
});
