// Teste de integração isolado: cria um schema temporário no PostgreSQL local,
// aplica as migrações e remove somente esse schema ao terminar.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = fileURLToPath(new URL("../", import.meta.url));
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL para o PostgreSQL local de desenvolvimento.");
const originalUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(originalUrl.hostname))
  throw new Error("Este teste aceita somente PostgreSQL local.");
const schema = `project_delete_test_${Date.now().toString(36)}`;
if (!/^project_delete_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
let client;
let created = false;
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-delete-"));
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  const testUrl = new URL(originalUrl);
  testUrl.searchParams.set("schema", schema);
  process.env.DATABASE_URL = testUrl.toString();
  // Migrações antigas contêm referências explícitas a public. Substituí-las só
  // nesta cópia de teste impede que o ensaio toque o schema real.
  writeFileSync(
    path.join(temporaryProject, "schema.prisma"),
    readFileSync(path.join(root, "prisma/schema.prisma")),
  );
  mkdirSync(path.join(temporaryProject, "migrations"));
  for (const directory of readdirSync(path.join(root, "prisma/migrations"), {
    withFileTypes: true,
  }).filter(
    // As migrações a partir das referências entram depois do seed, na ordem original.
    (item) => item.isDirectory() && item.name < "20261107010000_referencias_projetos_avaliacoes",
  )) {
    const target = path.join(temporaryProject, "migrations", directory.name);
    mkdirSync(target);
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
    {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (migration.status !== 0)
    throw new Error(
      `Falha ao preparar o schema temporário:\n${migration.stdout}\n${migration.stderr}`,
    );
  ({ default: client } = await import("../src/config/prisma.js"));
  const { seedDemo } = await import("../prisma/seed-demo.js");
  await seedDemo(client);
  const snapshots = await client.avaliacaoPremiacao.findMany({ orderBy: { id: "asc" } });
  for (const migrationName of readdirSync(path.join(root, "prisma/migrations"), {
    withFileTypes: true,
  })
    .filter(
      (item) => item.isDirectory() && item.name >= "20261107010000_referencias_projetos_avaliacoes",
    )
    .map((item) => item.name)) {
    mkdirSync(path.join(temporaryProject, "migrations", migrationName));
    writeFileSync(
      path.join(temporaryProject, "migrations", migrationName, "migration.sql"),
      readFileSync(path.join(root, "prisma/migrations", migrationName, "migration.sql")),
    );
  }
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
  assert.deepEqual(await client.avaliacaoPremiacao.findMany({ orderBy: { id: "asc" } }), snapshots);
  assert.ok(
    (await client.projetoAvaliacao.count()) > 0,
    "Migração protege as avaliações preexistentes.",
  );
  const { exclusaoProjetosRepository: repository } =
    await import("../src/repositories/exclusaoProjetosRepository.js");
  const { premiacaoRepository: awards } =
    await import("../src/repositories/premiacaoRepository.js");
  const template = await client.projeto.findFirst();
  const person = await client.colaborador.findFirst({ where: { status: "ATIVO" } });
  const user = await client.usuario.findFirst();
  const rule = await client.regraPremiacao.findFirst({ where: { categoria: "DEV" } });
  let sequence = 0;
  const createProject = () =>
    client.projeto.create({
      data: {
        nome: `Exclusão isolada ${++sequence}`,
        clienteId: template.clienteId,
        tipoContrato: template.tipoContrato,
        horasContratadas: 10,
        valorProjeto: 1000,
        dataInicio: new Date("2026-01-01"),
      },
    });
  const awardData = (projectId) => ({
    projetoIds: [projectId],
    sprintIds: [],
    respostas: [],
    percentualBase: null,
    percentualInformado: null,
    justificativaPercentual: "",
    observacoes: "Teste isolado",
  });
  const children = {
    equipe: (id) =>
      client.projetoColaborador.create({
        data: {
          projetoId: id,
          colaboradorId: person.id,
          papel: "Dev",
          dataEntrada: new Date("2026-01-01"),
          dataSaida: new Date("2026-02-01"),
        },
      }),
    tarefas: (id) =>
      client.tarefa.create({
        data: { projetoId: id, titulo: "Tarefa arquivada", statusRegistro: "INATIVO" },
      }),
    sprints: (id) =>
      client.sprint.create({
        data: { projetoId: id, nome: "Sprint arquivada", statusRegistro: "INATIVO" },
      }),
    apontamentos: (id) =>
      client.apontamentoHora.create({
        data: {
          projetoId: id,
          colaboradorId: person.id,
          data: new Date("2026-01-01"),
          horas: 1,
          descricao: "Histórico",
        },
      }),
    relatorios: (id) =>
      client.relatorioGerado.create({
        data: {
          filtros: { projetoIds: [id] },
          blocos: ["PROJETOS"],
          conteudo: { projetos: [{ id }] },
          criadoPorId: user.id,
        },
      }),
    avaliacoes: (id) =>
      awards.create(
        {
          colaboradorId: person.id,
          competencia: "2025-01",
          regraId: rule.id,
          dados: awardData(id),
        },
        user,
      ),
  };
  const blockedProjects = [];
  for (const [key, add] of Object.entries(children)) {
    const project = await createProject();
    await add(project.id);
    const info = await repository.inspect(project.id);
    assert.equal(info.podeExcluir, false);
    assert.equal(info.vinculos[key], 1);
    await assert.rejects(repository.remove(project.id), { statusCode: 409 });
    await assert.rejects(client.projeto.delete({ where: { id: project.id } }), { code: "P2003" });
    blockedProjects.push(project);
  }
  // Um rascunho editado mantém também a referência que já utilizou anteriormente.
  const originalAward = await client.avaliacaoPremiacao.findFirst({
    where: { competencia: "2025-01" },
  });
  const alternate = await createProject();
  await awards.update(originalAward.id, { revisao: 1, dados: awardData(alternate.id) }, user);
  assert.equal((await repository.inspect(blockedProjects.at(-1).id)).vinculos.avaliacoes, 1);
  assert.equal((await repository.inspect(alternate.id)).vinculos.avaliacoes, 1);
  // Referência apenas na fotografia da base também é protegida pelo banco.
  const snapshotOnly = await createProject();
  await client.avaliacaoPremiacao.create({
    data: {
      colaboradorId: person.id,
      competencia: "2025-02",
      categoria: "DEV",
      regraId: rule.id,
      criadoPorId: user.id,
      conteudo: { base: { projetos: [{ id: snapshotOnly.id }] } },
    },
  });
  await assert.rejects(repository.remove(snapshotOnly.id), { statusCode: 409 });
  const free = await createProject();
  assert.equal((await repository.inspect(free.id)).podeExcluir, true);
  await repository.remove(free.id);
  assert.equal(await client.projeto.findUnique({ where: { id: free.id } }), null);
  await assert.rejects(repository.remove(free.id), { statusCode: 404 });
  // Criação de referência e exclusão concorrentes nunca podem ambas confirmar.
  for (const [key, add] of Object.entries(children)) {
    const project = await createProject();
    const attach =
      key === "avaliacoes"
        ? () =>
            awards.create(
              {
                colaboradorId: person.id,
                competencia: "2025-03",
                regraId: rule.id,
                dados: awardData(project.id),
              },
              user,
            )
        : () => add(project.id);
    const results = await Promise.allSettled([attach(), repository.remove(project.id)]);
    assert.ok(
      results.some((result) => result.status === "rejected"),
      `${key}: exclusão e vínculo não confirmam juntos.`,
    );
    const surviving = await client.projeto.findUnique({ where: { id: project.id } });
    if (results[0].status === "fulfilled") {
      assert.ok(surviving);
      assert.equal((await repository.inspect(project.id)).podeExcluir, false);
    } else {
      assert.equal(results[1].status, "fulfilled");
      assert.equal(surviving, null);
    }
  }
  const double = await createProject();
  const deletes = await Promise.allSettled([
    repository.remove(double.id),
    repository.remove(double.id),
  ]);
  assert.equal(deletes.filter((result) => result.status === "fulfilled").length, 1);
  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { createTestSession } = await import("./helpers/session-fixture.mjs");
  const token = await createTestSession(client, user, env.jwtSecret);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/projetos`;
  const request = (url, method = "GET", authenticated = true) =>
    fetch(baseUrl + url, {
      method,
      headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
    });
  try {
    const project = await createProject();
    assert.equal((await request(`/${project.id}/permanente`, "DELETE", false)).status, 401);
    assert.equal((await request("/abc/permanente", "DELETE")).status, 400);
    assert.equal((await request(`/${project.id}/exclusao`)).status, 200);
    assert.equal((await request(`/${project.id}/permanente`, "DELETE")).status, 204);
    assert.equal((await request(`/${project.id}/exclusao`)).status, 404);
    const outdated = await createProject();
    assert.equal((await (await request(`/${outdated.id}/exclusao`)).json()).podeExcluir, true);
    await children.equipe(outdated.id);
    assert.equal((await request(`/${outdated.id}/permanente`, "DELETE")).status, 409);
    // DELETE existente continua sendo desativação/encerramento e mantém histórico.
    const oldDelete = await request(`/${blockedProjects[0].id}`, "DELETE");
    assert.equal(oldDelete.status, 200);
    assert.notEqual((await oldDelete.json()).status, "ATIVO");
    assert.ok(await client.projeto.findUnique({ where: { id: blockedProjects[0].id } }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "OK: migração preserva fotografias e referências existentes; API autenticada; bloqueios por histórico; exclusão vazia; prévia desatualizada; FKs e concorrência de todas as referências.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-delete-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
