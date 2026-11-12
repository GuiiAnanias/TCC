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
const schema = `hours_concurrency_test_${Date.now().toString(36)}`;
if (!/^hours_concurrency_test_[a-z0-9]+$/.test(schema))
  throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-hours-"));
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
  }).filter((item) => item.isDirectory())) {
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
  const { apontamentosService: hours } = await import("../src/services/apontamentosService.js");
  const { apontamentosRepository: repository } =
    await import("../src/repositories/apontamentosRepository.js");
  const customer = await client.cliente.create({ data: { nome: "Cliente de teste" } });
  const project = await client.projeto.create({
    data: {
      nome: "Projeto de concorrência",
      clienteId: customer.id,
      tipoContrato: "ESCOPO_FECHADO",
      horasContratadas: 100,
      valorProjeto: 1000,
      dataInicio: new Date("2026-01-01"),
    },
  });
  const people = await Promise.all(
    [1, 2, 3].map((n) =>
      client.colaborador.create({
        data: {
          nomeCompleto: `Pessoa ${n}`,
          email: `person${n}@example.local`,
          cargo: "QA",
          departamento: "Qualidade",
        },
      }),
    ),
  );
  // Este cenário verifica a soma de horas; manter uma equipe válida no projeto.
  await client.projetoColaborador.create({
    data: {
      projetoId: project.id,
      colaboradorId: people[2].id,
      papel: "QA",
      dataEntrada: new Date("2026-01-01"),
    },
  });
  const entry = (date, amount, person = people[0]) => ({
    projetoId: project.id,
    colaboradorId: person.id,
    data: new Date(date),
    horas: amount,
    descricao: "Horas de teste",
    status: "PENDENTE",
  });
  const total = async (date, person = people[0]) =>
    Number(
      (
        await client.apontamentoHora.aggregate({
          where: { colaboradorId: person.id, data: new Date(date) },
          _sum: { horas: true },
        })
      )._sum.horas ?? 0,
    );
  const oneAccepted = (results) => {
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.equal(
      rejected.reason.statusCode,
      400,
      "Após repetir a transação, o saldo deve ser revalidado.",
    );
  };

  // Coordenar somente o agendamento: as leituras, escritas, transações e conflitos
  // são reais no PostgreSQL. Ambas as primeiras leituras terminam antes das escritas.
  async function raceAfterSum(operations) {
    const original = repository.sumHorasNoDia;
    const barrier = Promise.withResolvers();
    const timer = setTimeout(
      () => barrier.reject(new Error("As leituras concorrentes não chegaram à barreira.")),
      4000,
    );
    let reads = 0;
    repository.sumHorasNoDia = async (...args) => {
      const value = await original(...args);
      const ordinal = ++reads;
      if (ordinal === 2) barrier.resolve();
      if (ordinal <= 2) await barrier.promise;
      return value;
    };
    try {
      return await Promise.allSettled(operations.map((operation) => operation()));
    } finally {
      clearTimeout(timer);
      repository.sumHorasNoDia = original;
    }
  }

  oneAccepted(
    await raceAfterSum([
      () => hours.create(entry("2026-01-01", 16)),
      () => hours.create(entry("2026-01-01", 16)),
    ]),
  );
  assert.equal(await total("2026-01-01"), 16, "Dia inicialmente vazio não pode receber 32 horas.");

  const valid = await raceAfterSum([
    () => hours.create(entry("2026-01-02", 12)),
    () => hours.create(entry("2026-01-02", 12)),
  ]);
  assert.ok(
    valid.every((result) => result.status === "fulfilled"),
    "Inclusões concorrentes que cabem no limite devem funcionar.",
  );
  assert.equal(await total("2026-01-02"), 24);

  const edits = await Promise.all([
    hours.create(entry("2026-01-03", 8)),
    hours.create(entry("2026-01-03", 8)),
  ]);
  oneAccepted(await raceAfterSum(edits.map((row) => () => hours.update(row.id, { horas: 16 }))));
  assert.equal(
    await total("2026-01-03"),
    24,
    "Editar desconta o próprio registro, mas considera o outro após conflito.",
  );

  const movedDates = await Promise.all([
    hours.create(entry("2026-01-04", 16)),
    hours.create(entry("2026-01-05", 16)),
  ]);
  oneAccepted(
    await raceAfterSum(
      movedDates.map((row) => () => hours.update(row.id, { data: new Date("2026-01-06") })),
    ),
  );
  assert.equal(await total("2026-01-06"), 16);
  assert.equal(
    (await total("2026-01-04")) + (await total("2026-01-05")),
    16,
    "Transferência rejeitada conserva a origem.",
  );

  const movedPeople = await Promise.all(
    people.slice(0, 2).map((person) => hours.create(entry("2026-01-07", 16, person))),
  );
  oneAccepted(
    await raceAfterSum(
      movedPeople.map((row) => () => hours.update(row.id, { colaboradorId: people[2].id })),
    ),
  );
  assert.equal(await total("2026-01-07", people[2]), 16);
  assert.equal((await total("2026-01-07", people[0])) + (await total("2026-01-07", people[1])), 16);

  const mixed = await hours.create(entry("2026-01-08", 8));
  oneAccepted(
    await raceAfterSum([
      () => hours.update(mixed.id, { horas: 16 }),
      () => hours.create(entry("2026-01-08", 16)),
    ]),
  );
  assert.ok((await total("2026-01-08")) <= 24);

  const opposite = await Promise.all(
    people.slice(0, 2).map((person) => hours.create(entry("2026-01-09", 8, person))),
  );
  const swaps = await raceAfterSum(
    opposite.map(
      (row, index) => () => hours.update(row.id, { colaboradorId: people[1 - index].id }),
    ),
  );
  assert.ok(swaps.every((result) => result.status === "fulfilled"));
  assert.equal(await total("2026-01-09", people[0]), 8);
  assert.equal(await total("2026-01-09", people[1]), 8);

  const invoiceRate = await client.itemTabelaRemuneracao.create({
    data: { nivel: "Teste faturamento", valorHora: 100 },
  });
  await client.configuracaoFinanceira.create({
    data: {
      colaboradorId: people[0].id,
      itemTabelaId: invoiceRate.id,
      valorHoraAplicado: 100,
      nivelAplicado: invoiceRate.nivel,
      dataInicio: new Date("2026-01-01"),
    },
  });
  await client.projetoColaborador.create({
    data: {
      projetoId: project.id,
      colaboradorId: people[0].id,
      papel: "Dev",
      dataEntrada: new Date("2026-01-01"),
    },
  });
  // Faturar entre a leitura e a escrita exige repetir também a leitura do status.
  async function billBeforeWrite(method, change) {
    const row = await hours.create(entry("2026-01-10", 1));
    const original = repository[method];
    const ready = Promise.withResolvers();
    const release = Promise.withResolvers();
    const timer = setTimeout(() => {
      ready.reject(new Error("A escrita não chegou à barreira."));
      release.resolve();
    }, 4000);
    let paused = false;
    repository[method] = async (...args) => {
      if (!paused) {
        paused = true;
        ready.resolve();
        await release.promise;
      }
      return original(...args);
    };
    const pending = method === "delete" ? hours.remove(row.id) : hours.update(row.id, change);
    // Observar a rejeição desde o início também em caso de falha na coordenação.
    const outcome = pending.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await ready.promise;
      await hours.update(row.id, { status: "FATURADO" });
      release.resolve();
      assert.equal((await outcome).error?.statusCode, 409);
      const saved = await client.apontamentoHora.findUnique({ where: { id: row.id } });
      assert.equal(saved.status, "FATURADO");
      assert.equal(Number(saved.horas), 1);
    } finally {
      clearTimeout(timer);
      release.resolve();
      await outcome;
      repository[method] = original;
    }
  }
  await billBeforeWrite("update", { horas: 2 });
  await billBeforeWrite("delete");

  const decimal = await hours.create(entry("2026-01-11", 23.99));
  await hours.create(entry("2026-01-11", 0.01));
  await assert.rejects(hours.create(entry("2026-01-11", 0.01)), { statusCode: 400 });
  await hours.update(decimal.id, { descricao: "Descrição atualizada" });
  await hours.remove(decimal.id);
  await hours.create(entry("2026-01-11", 23.99));
  assert.equal(await total("2026-01-11"), 24);

  const tomorrow = new Date(Date.now() + 2 * 86400000);
  await assert.rejects(hours.create({ ...entry("2026-01-12", 1), data: tomorrow }), {
    statusCode: 400,
  });
  await assert.rejects(hours.update(decimal.id, { horas: 1 }), { statusCode: 404 });

  // Confirmar também que o contrato HTTP devolve validação, sem gravar o excesso.
  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { createTestSession } = await import("./helpers/session-fixture.mjs");
  const user = await client.usuario.create({
    data: { nomeUsuario: "hours-test", email: "hours-test@example.local", senhaHash: "test-only" },
  });
  const token = await createTestSession(client, user, env.jwtSecret);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const results = await raceAfterSum(
      [1, 2].map(() => async () => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/apontamentos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(entry("2026-01-12", 16)),
        });
        return { status: response.status, body: await response.json() };
      }),
    );
    assert.ok(results.every((result) => result.status === "fulfilled"));
    const responses = results.map((result) => result.value);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
    assert.match(responses.find((response) => response.status === 400).body.message, /24 h/);
    assert.equal(await total("2026-01-12"), 16);

    const post = (data) =>
      fetch(`http://127.0.0.1:${server.address().port}/api/apontamentos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const historical = await hours.create(entry("2026-01-13", 2));
    await client.colaborador.update({ where: { id: people[0].id }, data: { status: "INATIVO" } });
    assert.equal((await post(entry("2026-01-14", 1))).status, 409);
    await client.colaborador.update({ where: { id: people[0].id }, data: { status: "ATIVO" } });
    await client.projeto.update({ where: { id: project.id }, data: { status: "ENCERRADO" } });
    assert.equal((await post(entry("2026-01-14", 1))).status, 409);
    await client.colaborador.update({ where: { id: people[0].id }, data: { status: "INATIVO" } });
    await hours.update(historical.id, { horas: 1, descricao: "Correção histórica" });
    assert.equal(Number((await hours.getById(historical.id)).horas), 1);
    assert.equal(await total("2026-01-14"), 0);
    await hours.remove(historical.id);
    await client.projeto.update({ where: { id: project.id }, data: { status: "ATIVO" } });
    await client.colaborador.update({ where: { id: people[0].id }, data: { status: "ATIVO" } });

    // Inativação ainda não confirmada: a criação espera a trava e revalida o estado.
    for (const model of ["colaborador", "projeto"]) {
      const id = model === "colaborador" ? people[0].id : project.id;
      const updated = Promise.withResolvers();
      const release = Promise.withResolvers();
      const reached = Promise.withResolvers();
      const originalLock = repository.lockReferences;
      const transaction = client.$transaction(async (db) => {
        await db[model].update({
          where: { id },
          data: { status: model === "projeto" ? "ENCERRADO" : "INATIVO" },
        });
        updated.resolve();
        await release.promise;
      });
      await updated.promise;
      repository.lockReferences = (...args) => {
        reached.resolve();
        return originalLock(...args);
      };
      const creation = hours.create(entry("2026-01-15", 1));
      const rejected = assert.rejects(creation, { statusCode: 409 });
      try {
        await reached.promise;
        release.resolve();
        await transaction;
        await rejected;
        assert.equal(await total("2026-01-15"), 0);
      } finally {
        release.resolve();
        repository.lockReferences = originalLock;
        await transaction;
        await client[model].update({ where: { id }, data: { status: "ATIVO" } });
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(
    "OK: concorrência em dia vazio, 24 h exatas, edições, transferências entre datas/pessoas, operações mistas, faturamento simultâneo, exclusão, decimais e API autenticada.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-hours-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
