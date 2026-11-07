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
const schema = `tasks_step4_test_${Date.now().toString(36)}`;
if (!/^tasks_step4_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
let client;
let created = false;
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-tasks-"));
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
  const { tarefasRepository: repo } = await import("../src/repositories/tarefasRepository.js");
  const { apontamentosService: hours } = await import("../src/services/apontamentosService.js");
  const { tarefaCreateSchema, tarefaUpdateSchema, sprintCreateSchema, sprintUpdateSchema } =
    await import("../src/schemas/tarefasSchemas.js");
  const { dashboardService } = await import("../src/services/dashboardService.js");
  const customer = await client.cliente.create({ data: { nome: "Cliente de teste" } });
  const projectData = {
    clienteId: customer.id,
    tipoContrato: "ESCOPO_SEMIABERTO",
    horasContratadas: 100,
    valorProjeto: 1000,
    dataInicio: new Date("2026-09-01"),
  };
  const project = await client.projeto.create({ data: { ...projectData, nome: "Projeto um" } });
  const other = await client.projeto.create({ data: { ...projectData, nome: "Projeto dois" } });
  const people = await Promise.all(
    [1, 2].map((number) =>
      client.colaborador.create({
        data: {
          nomeCompleto: `Pessoa ${number}`,
          email: `p${number}@example.local`,
          cargo: "QA",
          departamento: "Qualidade",
        },
      }),
    ),
  );
  for (const person of people)
    await client.projetoColaborador.create({
      data: {
        projetoId: project.id,
        colaboradorId: person.id,
        papel: "QA",
        dataEntrada: new Date("2026-09-01"),
      },
    });
  await client.projetoColaborador.create({
    data: {
      projetoId: other.id,
      colaboradorId: people[1].id,
      papel: "QA",
      dataEntrada: new Date("2026-09-01"),
    },
  });
  const rate = await client.itemTabelaRemuneracao.create({
    data: { nivel: "Júnior I", valorHora: 45 },
  });
  for (const person of people)
    await client.configuracaoFinanceira.create({
      data: {
        colaboradorId: person.id,
        itemTabelaId: rate.id,
        valorHoraAplicado: 45,
        nivelAplicado: "Júnior I",
        dataInicio: new Date("2026-09-01"),
      },
    });
  const initial = await hours.create({
    projetoId: project.id,
    colaboradorId: people[0].id,
    data: new Date("2026-09-01"),
    horas: 8,
    descricao: "Apontamento anterior sem tarefa",
    status: "APROVADO",
  });
  assert.equal(initial.tarefaId, null);
  const summaryBefore = (await dashboardService.get({})).resumo;
  const sprint = await repo.saveSprint(
    null,
    sprintCreateSchema.parse({
      projetoId: project.id,
      nome: "Sprint um",
      dataInicio: "2026-09-01",
      dataFim: "2026-09-15",
    }),
  );
  const task = await repo.save(
    null,
    tarefaCreateSchema.parse({
      projetoId: project.id,
      titulo: "Implementar fluxo",
      sprintId: sprint.id,
      minutosEstimados: 127,
      correcao: true,
      responsavelIds: people.map((p) => p.id),
    }),
  );
  assert.equal(task.minutosEstimados, 127);
  assert.equal(task.dataConclusao, null);
  assert.equal(task.externalId, null);
  assert.equal(task.origem, "MANUAL");
  await hours.update(initial.id, { tarefaId: task.id });
  assert.equal(await client.apontamentoHora.count(), 1);
  assert.equal(
    (await client.apontamentoHora.findUnique({ where: { id: initial.id } })).status,
    "APROVADO",
  );
  for (const key of [
    "horas",
    "custo",
    "custoBase",
    "bonificacao",
    "horasSemCusto",
    "assertividade",
  ])
    assert.equal((await dashboardService.get({})).resumo[key], summaryBefore[key]);
  let listed = (await repo.findAll({ projetoId: project.id }))[0];
  assert.equal(listed.responsaveis.length, 2);
  assert.equal(Number(listed.horasRealizadas), 8);
  assert.equal(Number((await dashboardService.get({})).resumo.custo), 360);
  await hours.create({
    projetoId: project.id,
    colaboradorId: people[1].id,
    tarefaId: task.id,
    data: new Date("2026-09-02"),
    horas: 2.12,
    descricao: "Segundo colaborador",
  });
  assert.equal(Number((await repo.findAll({ projetoId: project.id }))[0].horasRealizadas), 10.12);
  const foreignSprint = await repo.saveSprint(
    null,
    sprintCreateSchema.parse({ projetoId: other.id, nome: "Outra sprint" }),
  );
  await assert.rejects(
    repo.save(
      null,
      tarefaCreateSchema.parse({
        projetoId: project.id,
        titulo: "Sprint incorreta",
        sprintId: foreignSprint.id,
      }),
    ),
    { statusCode: 400 },
  );
  await assert.rejects(
    client.tarefa.create({
      data: { projetoId: project.id, titulo: "FK sprint", sprintId: foreignSprint.id },
    }),
    /Foreign key/,
  );
  await assert.rejects(
    hours.create({
      projetoId: other.id,
      tarefaId: task.id,
      colaboradorId: people[0].id,
      data: new Date("2026-09-01"),
      horas: 1,
      descricao: "Projeto incorreto",
    }),
    { statusCode: 400 },
  );
  await assert.rejects(
    client.apontamentoHora.create({
      data: {
        projetoId: other.id,
        tarefaId: task.id,
        colaboradorId: people[0].id,
        data: new Date("2026-09-01"),
        horas: 1,
        descricao: "FK tarefa",
      },
    }),
    /Foreign key/,
  );
  await assert.rejects(repo.save(task.id, { projetoId: other.id }), { statusCode: 409 });
  await assert.rejects(repo.saveSprint(sprint.id, { projetoId: other.id }), { statusCode: 409 });
  await repo.save(
    task.id,
    tarefaUpdateSchema.parse({
      status: "CONCLUIDA",
      dataInicio: "2026-09-01",
      dataConclusao: "2026-09-05",
    }),
  );
  await assert.rejects(repo.save(task.id, tarefaUpdateSchema.parse({ dataInicio: "2026-09-10" })), {
    statusCode: 400,
  });
  await assert.rejects(repo.save(task.id, tarefaUpdateSchema.parse({ status: "EM_ANDAMENTO" })), {
    statusCode: 400,
  });
  await repo.save(task.id, tarefaUpdateSchema.parse({ statusRegistro: "INATIVO" }));
  const archived = await repo.findById(task.id);
  assert.equal(archived.status, "CONCLUIDA");
  assert.equal(archived.correcao, true);
  assert.equal(archived.responsaveis.length, 2);
  assert.equal(await client.apontamentoHora.count(), 2);
  await assert.rejects(
    hours.create({
      projetoId: project.id,
      tarefaId: task.id,
      colaboradorId: people[0].id,
      data: new Date("2026-09-01"),
      horas: 1,
      descricao: "Tarefa arquivada",
    }),
    { statusCode: 409 },
  );
  await repo.saveSprint(sprint.id, sprintUpdateSchema.parse({ statusRegistro: "INATIVO" }));
  // Atualizar uma tarefa que já pertence à sprint arquivada continua possível.
  await repo.save(task.id, tarefaUpdateSchema.parse({ titulo: "Título atualizado" }));
  await assert.rejects(
    repo.save(
      null,
      tarefaCreateSchema.parse({
        projetoId: project.id,
        titulo: "Sprint arquivada",
        sprintId: sprint.id,
      }),
    ),
    { statusCode: 409 },
  );
  const outsider = await client.colaborador.create({
    data: {
      nomeCompleto: "Sem equipe",
      email: "outsider@example.local",
      cargo: "QA",
      departamento: "Qualidade",
    },
  });
  await assert.rejects(
    repo.save(
      null,
      tarefaCreateSchema.parse({
        projetoId: project.id,
        titulo: "Responsável incorreto",
        responsavelIds: [outsider.id],
      }),
    ),
    { statusCode: 400 },
  );
  await client.colaborador.update({ where: { id: people[0].id }, data: { status: "INATIVO" } });
  await repo.save(
    task.id,
    tarefaUpdateSchema.parse({ responsavelIds: people.map((person) => person.id) }),
  );
  await hours.update(initial.id, { tarefaId: null });
  assert.equal(await client.apontamentoHora.count(), 2);
  assert.equal(Number((await repo.findAll({ projetoId: project.id }))[0].horasRealizadas), 2.12);
  await client.projeto.update({ where: { id: project.id }, data: { status: "ENCERRADO" } });
  await assert.rejects(repo.save(task.id, { titulo: "Bloqueado" }), { statusCode: 409 });
  assert.equal((await repo.findAll({ projetoId: project.id })).length, 1);
  await assert.rejects(client.tarefa.delete({ where: { id: task.id } }), /Foreign key/);
  // Exercitar o contrato HTTP autenticado com o mesmo schema isolado.
  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { createTestSession } = await import("./helpers/session-fixture.mjs");
  const user = await client.usuario.create({
    data: { nomeUsuario: "tasks-test", email: "tasks-test@example.local", senhaHash: "test-only" },
  });
  const token = await createTestSession(client, user, env.jwtSecret);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api`;
  const send = (route, method, data) =>
    fetch(endpoint + route, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  try {
    const sprintResponse = await send("/sprints", "POST", {
      projetoId: other.id,
      nome: "Sprint via API",
    });
    assert.equal(sprintResponse.status, 201);
    const httpSprint = await sprintResponse.json();
    const taskResponse = await send("/tarefas", "POST", {
      projetoId: other.id,
      sprintId: httpSprint.id,
      titulo: "Tarefa via API",
      status: "CONCLUIDA",
      correcao: true,
      minutosEstimados: 127,
    });
    assert.equal(taskResponse.status, 201);
    const httpTask = await taskResponse.json();
    const archiveResponse = await send(`/tarefas/${httpTask.id}`, "PUT", {
      statusRegistro: "INATIVO",
    });
    assert.equal(archiveResponse.status, 200);
    const httpArchived = await archiveResponse.json();
    assert.equal(httpArchived.status, "CONCLUIDA");
    assert.equal(httpArchived.correcao, true);
    const invalidResponse = await send("/tarefas", "POST", {
      projetoId: other.id,
      titulo: "Data inválida",
      dataInicio: "2026-02-30",
    });
    assert.equal(invalidResponse.status, 400);
    const listResponse = await send(`/tarefas?projetoId=${other.id}&statusRegistro=INATIVO`, "GET");
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json())[0].horasRealizadas, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "OK: migrações, estimativa em minutos, responsabilidades, horas sem duplicação, preservação do custo, vínculos entre projetos, datas, arquivamento e consulta histórica.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-tasks-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
