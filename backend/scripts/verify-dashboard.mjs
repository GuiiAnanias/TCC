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
const schema = `dashboard_step5_test_${Date.now().toString(36)}`;
if (!/^dashboard_step5_test_[a-z0-9]+$/.test(schema))
  throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
let client;
let created = false;
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-dashboard-"));
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
  }).filter((item) => item.isDirectory())) {
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
  const { dashboardService: service } = await import("../src/services/dashboardService.js");
  await seedDemo(client);
  const base = await service.get({});
  const portal = base.projetos.find((row) => row.nome === "Portal do Cliente (demo)");
  const ana = await client.colaborador.findUnique({ where: { email: "ana.demo@exemplo.local" } });
  const bruno = await client.colaborador.findUnique({
    where: { email: "bruno.demo@exemplo.local" },
  });
  const diego = await client.colaborador.findUnique({
    where: { email: "diego.demo@exemplo.local" },
  });
  const gustavo = await client.colaborador.findUnique({
    where: { email: "gustavo.demo@exemplo.local" },
  });
  const helena = await client.colaborador.findUnique({
    where: { email: "helena.demo@exemplo.local" },
  });
  assert.equal(base.resumo.assertividadeEstimativas, 70.91);
  assert.equal(base.resumo.percentualCorrecoes, 23.19);
  assert.equal(base.resumo.percentualTarefasSemHoras, 18.18);
  assert.equal(base.resumo.percentualTarefasSemEstimativa, 25);
  assert.equal(base.ocorrencias.length, 9);
  assert.equal(new Set(base.ocorrencias.map((row) => row.chave)).size, 9);
  const detail = await service.project(portal.id);
  assert.equal(detail.resumo.horas, 22);
  assert.equal(detail.resumo.custo, 1212);
  assert.equal(detail.resumo.assertividadeEstimativas, 55.56);
  assert.equal(detail.resumo.percentualTarefasSemHoras, 33.33);
  assert.equal(detail.resumo.percentualTarefasSemEstimativa, 20);
  assert.equal(detail.resumo.percentualCorrecoes, 18.18);
  assert.equal(
    detail.apontamentos.reduce((sum, row) => sum + row.custo, 0),
    1212,
  );
  assert.equal(
    detail.colaboradores.reduce((sum, row) => sum + row.custo, 0),
    1212,
  );
  const anaDetail = await service.collaborator(ana.id);
  assert.equal(anaDetail.resumo.horas, 14);
  assert.equal(anaDetail.resumo.custo, 816);
  assert.equal(anaDetail.resumo.assertividade, null);
  assert.equal(anaDetail.resumo.assertividadeEstimativas, null);
  assert.equal(anaDetail.resumo.assertividadeTarefasContexto, 55.56);
  const login = anaDetail.tarefas.find((row) => row.titulo === "Tela de login");
  assert.equal(login.horasNoRecorte, 8);
  assert.equal(login.horasTotais, 14);
  assert.ok(anaDetail.apontamentos.every((row) => row.colaboradorId === ana.id));
  assert.equal((await service.collaborator(gustavo.id)).resumo.custo, 80);
  assert.equal((await service.collaborator(gustavo.id)).equipe.length, 0);
  assert.equal((await service.collaborator(helena.id)).resumo.custo, 340);
  assert.equal(
    (await service.project(base.projetos.find((row) => row.status === "INATIVO").id)).resumo.custo,
    340,
  );
  const october = { dataInicio: new Date("2026-10-01"), dataFim: new Date("2026-10-31") };
  const period = await service.get(october);
  assert.equal(period.resumo.horas, 46);
  assert.equal(period.resumo.assertividade, null);
  assert.equal(period.resumo.assertividadeEstimativas, 68.75);
  assert.equal(period.resumo.percentualCorrecoes, 34.78);
  assert.equal(period.resumo.percentualTarefasSemHoras, 25);
  assert.equal(period.resumo.percentualTarefasSemEstimativa, 20);
  const anaOctober = await service.collaborator(ana.id, october);
  assert.equal(anaOctober.resumo.horas, 6);
  assert.equal(anaOctober.resumo.custo, 396);
  const diegoOctober = await service.collaborator(diego.id, october);
  assert.equal(diegoOctober.equipe.length, 1);
  assert.equal(diegoOctober.equipe[0].papel, "Dev");
  const team = await service.get({ equipe: "Tecnologia" });
  assert.equal(team.resumo.custo, 1202);
  assert.ok(
    team.ocorrencias.some((row) => row.tipo === "SEM_VINCULO" && row.colaboradorId === gustavo.id),
  );
  assert.equal(team.resumo.assertividadeEstimativas, null);
  assert.ok(team.resumo.assertividadeTarefasContexto > 0);
  const archived = await service.get({ statusProjeto: "INATIVO" });
  assert.equal(archived.resumo.projetos, 1);
  assert.equal(archived.resumo.custo, 340);
  const septemberSprint = detail.projeto.sprints.find((row) => row.externalId === "portal-set");
  const sprint = await service.project(portal.id, { sprintId: septemberSprint.id });
  assert.equal(sprint.resumo.horas, 14);
  assert.equal(sprint.resumo.assertividade, null);
  assert.equal(sprint.resumo.assertividadeEstimativas, 57.14);
  assert.equal(
    (await service.get({ dataInicio: new Date("2030-01-01") })).resumo.percentualCorrecoes,
    null,
  );
  await assert.rejects(service.project(99999999), { statusCode: 404 });
  await assert.rejects(service.collaborator(99999999), { statusCode: 404 });

  // Incluir outro responsável muda o contexto individual, não multiplica horas/custos.
  await client.tarefaResponsavel.create({ data: { tarefaId: login.id, colaboradorId: bruno.id } });
  assert.deepEqual((await service.get({})).resumo, base.resumo);
  const brunoDetail = await service.collaborator(bruno.id);
  assert.equal(brunoDetail.resumo.horas, 8);
  assert.equal(brunoDetail.tarefas.find((row) => row.id === login.id).horasNoRecorte, 0);
  assert.equal(brunoDetail.tarefas.find((row) => row.id === login.id).horasTotais, 14);
  // Mudanças manuais precisam se refletir imediatamente, sem recalcular/seed.
  const originalEntry = await client.apontamentoHora.findFirst({
    where: { descricao: "Demonstração: portal-login-dev" },
  });
  await client.apontamentoHora.update({ where: { id: originalEntry.id }, data: { horas: 10 } });
  assert.equal((await service.project(portal.id)).resumo.custo, 1317);
  assert.equal((await service.project(portal.id)).resumo.assertividadeEstimativas, 50);
  assert.equal((await service.project(portal.id)).resumo.percentualCorrecoes, 16.67);
  const noEstimate = await client.tarefa.findFirst({
    where: { externalId: "portal-sem-estimativa" },
  });
  await client.tarefa.update({ where: { id: noEstimate.id }, data: { minutosEstimados: 120 } });
  assert.equal((await service.project(portal.id)).resumo.percentualTarefasSemEstimativa, 0);
  const noHours = await client.tarefa.findFirst({ where: { externalId: "portal-sem-horas" } });
  const carla = await client.colaborador.findUnique({
    where: { email: "carla.demo@exemplo.local" },
  });
  await client.apontamentoHora.create({
    data: {
      projetoId: portal.id,
      colaboradorId: carla.id,
      tarefaId: noHours.id,
      data: new Date("2026-10-07"),
      horas: 1,
      descricao: "Conferência manual",
    },
  });
  assert.equal((await service.project(portal.id)).resumo.percentualTarefasSemHoras, 0);
  assert.equal((await service.get({})).resumo.percentualTarefasSemHoras, 9.09);

  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { default: jwt } = await import("jsonwebtoken");
  const user = await client.usuario.findUnique({ where: { email: "admin@sistema.local" } });
  const token = jwt.sign({}, env.jwtSecret, { subject: String(user.id), expiresIn: "1m" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/dashboard`;
  const get = (path) => fetch(url + path, { headers: { Authorization: `Bearer ${token}` } });
  try {
    for (const path of [
      "",
      `/projetos/${portal.id}`,
      `/colaboradores/${ana.id}`,
      `/projetos/${portal.id}?dataInicio=2026-10-01&dataFim=2026-10-31`,
    ])
      assert.equal((await get(path)).status, 200, path);
    assert.equal((await get("/projetos/99999999")).status, 404);
    assert.equal((await get("/colaboradores/99999999")).status, 404);
    assert.equal((await get(`/projetos/${portal.id}?dataInicio=2026-02-30`)).status, 400);
    assert.equal((await fetch(`${url}/projetos/${portal.id}`)).status, 401);
    const options = await (await get("/opcoes")).json();
    assert.equal(options.projetos.length, 6);
    assert.equal(options.colaboradores.length, 9);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "OK: indicadores, filtros, sprints, histórico, auditoria, contexto compartilhado, custos conciliados, alterações manuais e API autenticada de projeto/colaborador.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-dashboard-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
