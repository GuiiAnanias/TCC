// Integração com PostgreSQL local em schema temporário; não modifica a base da interface.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = fileURLToPath(new URL("../", import.meta.url));
if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL para o PostgreSQL local.");
const originalUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(originalUrl.hostname))
  throw new Error("Este teste aceita somente PostgreSQL local.");
const schema = `auth_session_test_${Date.now().toString(36)}`;
if (!/^auth_session_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-auth-"));
let client;
let created = false;

try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  const testUrl = new URL(originalUrl);
  testUrl.searchParams.set("schema", schema);
  process.env.DATABASE_URL = testUrl.toString();
  writeFileSync(
    path.join(temporaryProject, "schema.prisma"),
    readFileSync(path.join(root, "prisma/schema.prisma")),
  );
  mkdirSync(path.join(temporaryProject, "migrations"));
  for (const directory of readdirSync(path.join(root, "prisma/migrations"), {
    withFileTypes: true,
  }).filter((item) => item.isDirectory() && item.name !== "20261104010000_sessoes_revogaveis")) {
    const target = path.join(temporaryProject, "migrations", directory.name);
    mkdirSync(target);
    // Algumas migrações antigas qualificam tabelas com public; adaptar apenas a cópia de teste.
    const sql = readFileSync(
      path.join(root, "prisma/migrations", directory.name, "migration.sql"),
      "utf8",
    );
    writeFileSync(path.join(target, "migration.sql"), sql.replaceAll('"public".', `"${schema}".`));
  }
  writeFileSync(
    path.join(temporaryProject, "migrations/migration_lock.toml"),
    'provider = "postgresql"\n',
  );
  const migration = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      path.join(temporaryProject, "schema.prisma"),
    ],
    { cwd: root, env: process.env, encoding: "utf8", windowsHide: true },
  );
  if (migration.status !== 0)
    throw new Error(
      `Falha ao preparar o schema temporário:\n${migration.stdout}\n${migration.stderr}`,
    );

  ({ default: client } = await import("../src/config/prisma.js"));
  // Base anterior com uma conta existente: a migração não troca seu hash.
  const { default: bcrypt } = await import("bcrypt");
  const password = "SenhaInicial123";
  const hash = await bcrypt.hash(password, 4);
  const [legacyUser] =
    await client.$queryRaw`INSERT INTO usuarios ("nomeUsuario", email, "senhaHash", "updatedAt") VALUES ('auth-test', 'auth@example.local', ${hash}, NOW()) RETURNING id`;
  const migrationName = "20261104010000_sessoes_revogaveis";
  mkdirSync(path.join(temporaryProject, "migrations", migrationName));
  writeFileSync(
    path.join(temporaryProject, "migrations", migrationName, "migration.sql"),
    readFileSync(path.join(root, "prisma/migrations", migrationName, "migration.sql")),
  );
  const applied = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      path.join(temporaryProject, "schema.prisma"),
    ],
    { cwd: root, env: process.env, encoding: "utf8", windowsHide: true },
  );
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  const migrated = await client.usuario.findUnique({ where: { id: legacyUser.id } });
  assert.equal(migrated.senhaHash, hash);
  assert.equal(migrated.versaoSessao, 0);
  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { senhaService } = await import("../src/services/senhaService.js");
  const { sessoesRepository } = await import("../src/repositories/sessoesRepository.js");
  const { default: jwt } = await import("jsonwebtoken");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const send = (route, body, token) =>
    fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async (senha = password, login = "auth-test") => {
    const response = await send("/login", { login, senha });
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).token;
  };
  const me = (token) => send("/me", undefined, token);
  try {
    const first = await login();
    const second = await login();
    assert.notEqual(first, second);
    assert.equal((await me(first)).status, 200);
    assert.equal((await send("/logout", {}, first)).status, 204);
    assert.equal((await me(first)).status, 401);
    assert.equal((await me(second)).status, 200);
    const reset = await senhaService.gerarLink("auth-test", {
      frontendUrl: "http://localhost:5173",
    });
    const token = new URL(reset.link).searchParams.get("token");
    const results = await Promise.all([
      send("/redefinir-senha", { token, novaSenha: "SenhaNova#123" }),
      send("/redefinir-senha", { token, novaSenha: "SenhaNova#123" }),
    ]);
    assert.deepEqual(results.map((response) => response.status).sort(), [200, 400]);
    assert.equal((await me(second)).status, 401);
    assert.equal((await send("/login", { login: "auth-test", senha: password })).status, 401);
    const fresh = await login("SenhaNova#123");
    const profile = await (await me(fresh)).json();
    assert.equal(profile.user.nomeUsuario, "auth-test");
    assert.equal(profile.user.versaoSessao, undefined);
    assert.equal(profile.user.senhaHash, undefined);
    const legacy = jwt.sign({}, env.jwtSecret, { subject: String(migrated.id), expiresIn: "5m" });
    assert.equal((await me(legacy)).status, 401);
    const unknown = jwt.sign({}, env.jwtSecret, {
      subject: String(migrated.id),
      jwtid: "inexistente",
      expiresIn: "5m",
    });
    assert.equal((await me(unknown)).status, 401);
    const expired = jwt.sign({}, env.jwtSecret, {
      subject: String(migrated.id),
      jwtid: jwt.decode(fresh).jti,
      expiresIn: -1,
    });
    assert.equal((await me(expired)).status, 401);
    await client.sessao.update({
      where: { id: jwt.decode(fresh).jti },
      data: { expiraEm: new Date(0) },
    });
    assert.equal((await me(fresh)).status, 401);
    const active = await login("SenhaNova#123");
    await client.usuario.update({ where: { id: migrated.id }, data: { status: "INATIVO" } });
    assert.equal((await me(active)).status, 401);
    await client.usuario.update({ where: { id: migrated.id }, data: { status: "ATIVO" } });

    // Troca de senha entre comparação do bcrypt e criação da sessão.
    const resetAgain = await senhaService.gerarLink("auth-test", {
      frontendUrl: "http://localhost:5173",
    });
    const create = sessoesRepository.create;
    sessoesRepository.create = async (...args) => {
      await senhaService.redefinir(
        new URL(resetAgain.link).searchParams.get("token"),
        "SenhaFinal#123",
      );
      return create(...args);
    };
    try {
      assert.equal(
        (await send("/login", { login: "auth-test", senha: "SenhaNova#123" })).status,
        401,
      );
    } finally {
      sessoesRepository.create = create;
    }
    assert.equal((await me(active)).status, 401);
    assert.equal((await me(await login("SenhaFinal#123"))).status, 200);

    // Contas anteriores com senha longa continuam autenticando; novas senhas são limitadas em bytes.
    const longPassword = "é".repeat(40);
    await client.usuario.create({
      data: {
        nomeUsuario: "legacy-long",
        email: "legacy-long@example.local",
        senhaHash: await bcrypt.hash(longPassword, 4),
      },
    });
    const legacySession = await login(longPassword, "legacy-long");
    assert.equal((await me(legacySession)).status, 200);
    const longReset = await senhaService.gerarLink("legacy-long", {
      frontendUrl: "http://localhost:5173",
    });
    const longToken = new URL(longReset.link).searchParams.get("token");
    for (const novaSenha of [
      "A1!" + "a".repeat(70),
      "A1!" + "é".repeat(35),
      "A1!" + "🔒".repeat(18),
    ]) {
      const invalid = await send("/redefinir-senha", { token: longToken, novaSenha });
      assert.equal(invalid.status, 400);
      assert.match((await invalid.json()).errors[0].message, /72 bytes/);
      assert.equal(
        (await me(legacySession)).status,
        200,
        "Senha inválida não consome o link nem revoga a sessão.",
      );
    }
    assert.equal(
      (
        await send("/redefinir-senha", {
          token: longToken,
          novaSenha: "A1!" + "é".repeat(34) + "a",
        })
      ).status,
      200,
    );
    assert.equal((await me(legacySession)).status, 401);
    assert.equal((await me(await login("A1!" + "é".repeat(34) + "a", "legacy-long"))).status, 200);

    const { limitesAutenticacaoRepository: limits } =
      await import("../src/repositories/limitesAutenticacaoRepository.js");
    const { createHmac } = await import("node:crypto");
    // Clientes independentes compartilham o mesmo contador, inclusive em concorrência.
    const secondClient = new PrismaClient();
    const concurrencyKey = "teste-concorrencia";
    try {
      const attempts = await Promise.all(
        Array.from({ length: 24 }, (_, index) =>
          limits.consume(concurrencyKey, 5, 60000, index % 2 ? client : secondClient),
        ),
      );
      assert.equal(attempts.filter((result) => result.allowed).length, 5);
      await client.limiteAutenticacao.update({
        where: { chave: concurrencyKey },
        data: { expiraEm: new Date(0) },
      });
      assert.equal((await limits.consume(concurrencyKey, 5, 60000, secondClient)).allowed, true);
    } finally {
      await secondClient.$disconnect();
    }
    await client.limiteAutenticacao.deleteMany({ where: { chave: concurrencyKey } });

    // Identificador limita inclusive desconhecidos, sem revelar existência da conta.
    for (let index = 0; index < env.authLoginLimit.identifierLimit; index++)
      assert.equal((await send("/login", { login: "inexistente", senha: "errada" })).status, 401);
    const blocked = await send("/login", { login: " INEXISTENTE ", senha: "errada" });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("Retry-After"), "10");
    const corpoBloqueio = await blocked.json();
    assert.deepEqual(corpoBloqueio, {
      message: "Muitas tentativas. Tente novamente em 10 segundos.",
      tentarNovamenteEm: 10,
    });
    // Durante o bloqueio, insistir não prorroga; depois dele, um novo erro sobe para 1 minuto e
    // depois para 5 minutos.
    assert.ok(
      Number(
        (await send("/login", { login: "inexistente", senha: "errada" })).headers.get(
          "Retry-After",
        ),
      ) <= 10,
    );
    const vencerBloqueios = () =>
      client.$executeRaw`UPDATE limites_autenticacao SET "bloqueadoAte" = CURRENT_TIMESTAMP - interval '1 second' WHERE "bloqueadoAte" IS NOT NULL`;
    for (const [segundos, texto] of [
      [60, "1 minuto"],
      [300, "5 minutos"],
      [300, "5 minutos"],
    ]) {
      await vencerBloqueios();
      const novo = await send("/login", { login: "inexistente", senha: "errada" });
      assert.equal(novo.status, 429);
      assert.deepEqual(await novo.json(), {
        message: `Muitas tentativas. Tente novamente em ${texto}.`,
        tentarNovamenteEm: segundos,
      });
    }
    assert.equal(
      (await me(await login("SenhaFinal#123"))).status,
      200,
      "Outra conta continua acessível pela mesma origem.",
    );
    // Ao atingir o teto da origem, variar login ou forjar X-Forwarded-For não contorna a proteção.
    let originBlocked;
    for (let index = 0; index <= env.authLoginLimit.originLimit; index++) {
      const response = await send("/login", { login: `desconhecido-${index}`, senha: "errada" });
      if (response.status === 429) {
        originBlocked = response;
        break;
      }
      assert.equal(response.status, 401);
    }
    assert.equal(originBlocked?.status, 429);
    const spoof = await fetch(base + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ login: "outro", senha: "errada" }),
    });
    assert.equal(spoof.status, 429);
    assert.match(
      (await spoof.json()).message,
      /^Muitas tentativas\. Tente novamente em \d+ minutos?/,
    );
    const originKey = createHmac("sha256", env.jwtSecret)
      .update(JSON.stringify(["login:origin", "127.0.0.1"]))
      .digest("hex");
    const stored = await client.limiteAutenticacao.findMany();
    assert.ok(stored.some((item) => item.chave === originKey));
    assert.ok(stored.every((item) => /^[a-f0-9]{64}$/.test(item.chave)));
    await client.limiteAutenticacao.updateMany({
      data: { expiraEm: new Date(0), bloqueadoAte: null },
    });
    assert.equal(
      (await me(await login("SenhaFinal#123"))).status,
      200,
      "O bloqueio expira sem intervenção administrativa.",
    );
    // Login certo zera a contagem do usuário: 9 erros + acerto + 9 erros não bloqueiam.
    for (let rodada = 0; rodada < 2; rodada++) {
      for (let index = 0; index < env.authLoginLimit.identifierLimit - 1; index++)
        assert.equal((await send("/login", { login: "auth-test", senha: "errada" })).status, 401);
      if (rodada === 0) assert.equal((await me(await login("SenhaFinal#123"))).status, 200);
    }
    await client.limiteAutenticacao.updateMany({
      data: { expiraEm: new Date(0), bloqueadoAte: null },
    });

    for (let index = 0; index < env.authResetLimit.identifierLimit; index++)
      assert.equal(
        (
          await send("/redefinir-senha", {
            token: "invalido-comprido-para-teste",
            novaSenha: "SenhaValida#123",
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await send("/redefinir-senha", {
          token: "invalido-comprido-para-teste",
          novaSenha: "SenhaValida#123",
        })
      ).status,
      429,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "OK: migração com conta existente, logout individual, redefinição concorrente, revogação global, tokens legados/expirados, inatividade, login concorrente, limite UTF-8, compatibilidade legada e limitação por origem/identificador com concorrência e expiração.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-auth-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
