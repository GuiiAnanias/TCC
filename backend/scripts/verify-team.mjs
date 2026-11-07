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
const schema = `team_periods_test_${Date.now().toString(36)}`;
if (!/^team_periods_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-team-"));
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
  }).filter(
    (item) => item.isDirectory() && item.name !== "20261103010000_equipe_periodos_unicos",
  )) {
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
  const { projetosService: teams } = await import("../src/services/projetosService.js");
  const customer = await client.cliente.create({ data: { nome: "Cliente de teste" } });
  const project = await client.projeto.create({
    data: {
      nome: "Projeto de equipe",
      clienteId: customer.id,
      tipoContrato: "ESCOPO_SEMIABERTO",
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
          email: `team${n}@example.local`,
          cargo: "QA",
          departamento: "TI",
        },
      }),
    ),
  );
  const member = (person, start, end, papel = "Dev") => ({
    projetoId: project.id,
    colaboradorId: person.id,
    papel,
    dataEntrada: new Date(start),
    dataSaida: end ? new Date(end) : null,
  });
  const previous = await client.projetoColaborador.create({
    data: member(people[0], "2026-01-01", "2026-02-01"),
  });
  await client.projetoColaborador.create({ data: member(people[0], "2026-02-01", null, "QA") });
  const bad = await client.projetoColaborador.create({
    data: member(people[1], "2026-01-01", "2026-03-01"),
  });
  await client.projetoColaborador.create({ data: member(people[1], "2026-02-01", "2026-04-01") });
  const migrationName = "20261103010000_equipe_periodos_unicos";
  mkdirSync(path.join(temporaryProject, "migrations", migrationName));
  writeFileSync(
    path.join(temporaryProject, "migrations", migrationName, "migration.sql"),
    readFileSync(path.join(root, "prisma/migrations", migrationName, "migration.sql"), "utf8"),
  );
  const runMigration = (...args) =>
    spawnSync(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        ...args,
        "--schema",
        path.join(temporaryProject, "schema.prisma"),
      ],
      { cwd: root, env: process.env, encoding: "utf8", windowsHide: true },
    );
  const refused = runMigration("deploy");
  assert.notEqual(refused.status, 0);

  assert.equal(
    (await client.projetoColaborador.findUnique({ where: { id: previous.id } })).dataSaida
      .toISOString()
      .slice(0, 10),
    "2026-02-01",
    "Falha deve desfazer a normalização de fronteira",
  );
  await client.projetoColaborador.delete({ where: { id: bad.id } });
  assert.equal(runMigration("resolve", "--rolled-back", migrationName).status, 0);
  const migrated = runMigration("deploy");
  assert.equal(migrated.status, 0, migrated.stderr + migrated.stdout);
  assert.equal(
    (await client.projetoColaborador.findUnique({ where: { id: previous.id } })).dataSaida
      .toISOString()
      .slice(0, 10),
    "2026-01-31",
  );
  const outcomes = await Promise.allSettled(
    [1, 2].map(() =>
      teams.addTeamMember(project.id, {
        colaboradorId: people[2].id,
        papel: "Dev",
        dataEntrada: new Date("2026-01-01"),
      }),
    ),
  );
  assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((x) => x.status === "rejected").reason.statusCode, 409);
  const current = outcomes.find((x) => x.status === "fulfilled").value;
  await assert.rejects(
    client.projetoColaborador.create({ data: member(people[2], "2026-01-05", null) }),
  );
  const changed = await teams.updateTeamMember(project.id, current.id, {
    papel: "QA",
    dataVigencia: new Date("2026-02-01"),
  });
  assert.equal(
    (await client.projetoColaborador.findUnique({ where: { id: current.id } })).dataSaida
      .toISOString()
      .slice(0, 10),
    "2026-01-31",
  );
  await assert.rejects(teams.updateTeamMember(project.id, current.id, { dataSaida: null }), {
    statusCode: 409,
  });
  await assert.rejects(
    teams.updateTeamMember(project.id, changed.id, { dataEntrada: new Date("2026-01-31") }),
    { statusCode: 409 },
  );
  await assert.rejects(
    teams.updateTeamMember(project.id, current.id, { dataSaida: new Date("2025-12-31") }),
    { statusCode: 400 },
  );
  const changes = await Promise.allSettled(
    ["Scrum Master", "Product Owner"].map((papel) =>
      teams.updateTeamMember(project.id, changed.id, {
        papel,
        dataVigencia: new Date("2026-03-01"),
      }),
    ),
  );
  assert.equal(changes.filter((x) => x.status === "fulfilled").length, 1);
  const periods = await client.projetoColaborador.findMany({
    where: { projetoId: project.id, colaboradorId: people[2].id },
    orderBy: { dataEntrada: "asc" },
  });
  assert.equal(periods.filter((x) => !x.dataSaida).length, 1);
  assert.equal(periods.length, 3);
  console.log(
    "OK: migração recusa conflitos sem alterar dados, fronteiras antigas preservadas, concorrência, restrições diretas, reabertura e troca de papel.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-team-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
