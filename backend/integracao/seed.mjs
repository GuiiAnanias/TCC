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
const schema = `seed_demo_test_${Date.now().toString(36)}`;
if (!/^seed_demo_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
let client;
let created = false;
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-seed-"));
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
  const { seedDemo } = await import("../prisma/seed-demonstracao.js");
  const { seedCompanies } = await import("../prisma/seed-empresas.js");
  const { clienteCreateSchema } = await import("../src/schemas/clientesSchemas.js");
  const { dashboardService } = await import("../src/services/dashboardService.js");
  const { tarefasRepository } = await import("../src/repositories/tarefasRepository.js");
  const { projetosService } = await import("../src/services/projetosService.js");
  const { apontamentosService } = await import("../src/services/apontamentosService.js");
  const { cargosTi, departamentosTi, niveisRemuneracao, papeisProjeto } =
    await import("../src/schemas/opcoesCadastro.js");
  const summary = await seedDemo(client);
  assert.deepEqual(summary, {
    clientes: 4,
    colaboradores: 9,
    faixas: 9,
    projetos: 6,
    sprints: 7,
    tarefas: 17,
    apontamentos: 16,
    avaliacoes: 2,
  });
  const models = [
    "usuario",
    "cliente",
    "colaborador",
    "itemTabelaRemuneracao",
    "configuracaoFinanceira",
    "bonificacaoPapel",
    "projeto",
    "projetoColaborador",
    "sprint",
    "tarefa",
    "tarefaResponsavel",
    "apontamentoHora",
    "regraPremiacao",
    "avaliacaoPremiacao",
  ];
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        models.map(async (model) => [
          model,
          await client[model].findMany({
            orderBy:
              model === "tarefaResponsavel"
                ? [{ tarefaId: "asc" }, { colaboradorId: "asc" }]
                : { id: "asc" },
          }),
        ]),
      ),
    );
  const initial = await snapshot();
  for (const { data } of seedCompanies) {
    clienteCreateSchema.parse(data);
    const saved = initial.cliente.find((item) => item.cnpj === data.cnpj);
    for (const [field, value] of Object.entries(data))
      assert.equal(saved[field], value, `${data.cnpj}: ${field}`);
  }
  for (const model of models) assert.ok(initial[model].length, `Tabela sem dados: ${model}`);
  const counts = {
    usuario: 2,
    cliente: 4,
    colaborador: 9,
    itemTabelaRemuneracao: 9,
    configuracaoFinanceira: 10,
    bonificacaoPapel: 5,
    projeto: 6,
    projetoColaborador: 12,
    sprint: 7,
    tarefa: 17,
    tarefaResponsavel: 18,
    apontamentoHora: 16,
    regraPremiacao: 2,
    avaliacaoPremiacao: 2,
  };
  for (const [model, expected] of Object.entries(counts))
    assert.equal(initial[model].length, expected, model);
  assert.equal(initial.configuracaoFinanceira.length, 10);
  assert.equal(initial.bonificacaoPapel.length, 5);
  assert.deepEqual([...new Set(initial.projeto.map((p) => p.status))].sort(), [
    "ATIVO",
    "CANCELADO",
    "ENCERRADO",
    "PAUSADO",
  ]);
  assert.deepEqual([...new Set(initial.projeto.map((p) => p.tipoContrato))].sort(), [
    "ESCOPO_FECHADO",
    "FEE_MENSAL",
    "POR_HORA",
    "SQUAD",
  ]);
  for (const person of initial.colaborador) {
    assert.ok(cargosTi.includes(person.cargo));
    assert.ok(departamentosTi.includes(person.departamento));
  }
  for (const rate of initial.itemTabelaRemuneracao)
    assert.ok(niveisRemuneracao.includes(rate.nivel));
  for (const member of initial.projetoColaborador) assert.ok(papeisProjeto.includes(member.papel));
  const dashboard = await dashboardService.get({});
  const rows = Object.fromEntries(dashboard.projetos.map((row) => [row.nome, row]));
  for (const [name, custo, assertividade] of [
    ["Portal do Cliente (demo)", 1212, 200],
    ["Aplicativo Mobile (demo)", 1079, 50],
    ["Integração de Dados (demo)", 560, 100],
    ["Projeto com pendências (demo)", 300, null],
    ["Projeto em planejamento (demo)", 0, null],
    ["Projeto encerrado (demo)", 340, 200],
  ]) {
    assert.equal(rows[name].custo, custo, name);
    assert.equal(rows[name].assertividade, assertividade, name);
  }
  assert.equal(dashboard.resumo.horas, 69);
  assert.equal(dashboard.resumo.custo, 3491);
  assert.equal(dashboard.resumo.bonificacao, 281);
  assert.equal(dashboard.resumo.horasSemCusto, 5);
  assert.equal(dashboard.resumo.registrosSemVinculo, 1);
  assert.equal(dashboard.resumo.assertividade, 137.5);
  assert.equal(dashboard.resumo.percentualCorrecoes, 23.19);
  assert.equal(dashboard.resumo.assertividadeEstimativas, 70.91);
  assert.equal(dashboard.resumo.percentualTarefasSemHoras, 18.18);
  assert.equal(dashboard.resumo.percentualTarefasSemEstimativa, 25);
  assert.equal(dashboard.resumo.correcoesParciais, true);
  assert.equal(dashboard.resumo.totalOcorrencias, 9);
  const portalTasks = await tarefasRepository.findAll({
    projetoId: rows["Portal do Cliente (demo)"].id,
  });
  const shared = portalTasks.find((task) => task.externalId === "portal-login");
  assert.equal(shared.responsaveis.length, 2);
  assert.equal(Number(shared.horasRealizadas), 14);
  assert.ok(
    initial.tarefa.some(
      (task) =>
        task.status === "CONCLUIDA" &&
        !initial.apontamentoHora.some((entry) => entry.tarefaId === task.id),
    ),
  );
  assert.ok(
    initial.tarefa.some(
      (task) =>
        task.minutosEstimados === null &&
        initial.apontamentoHora.some((entry) => entry.tarefaId === task.id),
    ),
  );
  assert.ok(initial.tarefa.some((task) => task.correcao));
  assert.ok(initial.tarefa.some((task) => task.statusRegistro === "INATIVO"));
  await seedDemo(client);
  assert.deepEqual(
    await snapshot(),
    initial,
    "Reexecutar o seed não deve duplicar nem alterar o banco.",
  );
  const portalProject = initial.projeto.find((p) => p.nome === "Portal do Cliente (demo)");
  const personId = initial.colaborador.find((p) => p.email === "ana.demo@exemplo.local").id;
  const historicalCounts = [
    initial.apontamentoHora.length,
    initial.tarefa.length,
    initial.projetoColaborador.length,
  ];
  for (const status of ["PAUSADO", "ENCERRADO", "CANCELADO"]) {
    await projetosService.update(portalProject.id, { status });
    assert.equal(
      (await projetosService.list({ status })).some((p) => p.id === portalProject.id),
      true,
    );
    assert.equal((await dashboardService.project(portalProject.id)).resumo.custo, 1212);
    assert.equal(
      (await dashboardService.get({ statusProjeto: status })).projetos.some(
        (p) => p.id === portalProject.id,
      ),
      true,
    );
    await assert.rejects(
      apontamentosService.create({
        projetoId: portalProject.id,
        colaboradorId: personId,
        data: new Date("2026-10-10"),
        horas: 1,
        descricao: "Bloqueado",
      }),
      { statusCode: 409 },
    );
    await assert.rejects(
      tarefasRepository.save(null, { projetoId: portalProject.id, titulo: "Bloqueada" }),
      { statusCode: 409 },
    );
    await assert.rejects(
      tarefasRepository.saveSprint(null, { projetoId: portalProject.id, nome: "Bloqueada" }),
      { statusCode: 409 },
    );
    await assert.rejects(
      projetosService.addTeamMember(portalProject.id, {
        colaboradorId: personId,
        papel: "Dev",
        dataEntrada: new Date("2026-11-01"),
      }),
      { statusCode: 400 },
    );
    await projetosService.update(portalProject.id, { status: "ATIVO" });
    assert.equal((await projetosService.getById(portalProject.id)).status, "ATIVO");
  }
  assert.deepEqual(
    [
      await client.apontamentoHora.count(),
      await client.tarefa.count(),
      await client.projetoColaborador.count(),
    ],
    historicalCounts,
  );
  const entry = initial.apontamentoHora.find(
    (item) => item.descricao === "Demonstração: portal-login-dev",
  );
  // Correção deliberada: desfaturar antes de editar as horas.
  await client.apontamentoHora.update({ where: { id: entry.id }, data: { status: "APROVADO" } });
  await client.apontamentoHora.update({ where: { id: entry.id }, data: { horas: 10 } });
  await client.projeto.update({
    where: { id: rows["Aplicativo Mobile (demo)"].id },
    data: { valorProjeto: 1079 },
  });
  await client.tarefa.update({
    where: { id: shared.id },
    data: { titulo: "Título ajustado manualmente", minutosEstimados: 600 },
  });
  await client.tarefaResponsavel.deleteMany({ where: { tarefaId: shared.id } });
  await client.itemTabelaRemuneracao.update({
    where: { nivel: "Pleno I" },
    data: { valorHora: 90 },
  });
  await client.usuario.update({
    where: { email: "admin@sistema.local" },
    data: { senhaHash: "senha-alterada-pelo-usuario" },
  });
  const manual = await snapshot();
  await seedDemo(client);
  assert.deepEqual(
    await snapshot(),
    manual,
    "Seed não deve desfazer ajustes manuais nem recriar responsáveis removidos.",
  );
  const changed = await dashboardService.get({});
  assert.equal(changed.projetos.find((row) => row.nome === "Portal do Cliente (demo)").custo, 1317);
  assert.equal(
    changed.projetos.find((row) => row.nome === "Aplicativo Mobile (demo)").assertividade,
    100,
  );
  assert.equal(changed.resumo.custo, 3596);
  // Equipe no cadastro: banco real isolado, gravação aninhada e rollback.
  const { projetoCreateSchema } = await import("../src/schemas/projetosSchemas.js");
  const projectData = {
    nome: "Cadastro com equipe inicial",
    clienteId: initial.cliente.find((p) => p.status === "ATIVO").id,
    tipoContrato: "SQUAD",
    horasContratadas: 10,
    valorProjeto: 1000,
    dataInicio: "2026-09-01",
  };
  const initialMember = (id) => ({ colaboradorId: id, papel: "Dev", dataEntrada: "2026-10-01" });
  const activePeople = initial.colaborador.filter((p) => p.status === "ATIVO").slice(0, 2);
  const beforeInvalid = await client.projeto.count();
  await assert.rejects(
    projetosService.create(
      projetoCreateSchema.parse({
        ...projectData,
        equipeInicial: [
          initialMember(activePeople[0].id),
          initialMember(initial.colaborador.find((p) => p.status === "INATIVO").id),
        ],
      }),
    ),
    { statusCode: 400 },
  );
  assert.equal(await client.projeto.count(), beforeInvalid);
  // Forçar uma falha no segundo vínculo, além da rejeição de duplicação no DTO.
  await assert.rejects(
    projetosService.create({
      ...projectData,
      dataInicio: new Date(projectData.dataInicio),
      equipeInicial: [initialMember(activePeople[0].id), initialMember(activePeople[0].id)],
    }),
  );
  assert.equal(
    await client.projeto.count(),
    beforeInvalid,
    "Falha aninhada não deixa projeto órfão.",
  );
  const batch = await projetosService.create(
    projetoCreateSchema.parse({
      ...projectData,
      equipeInicial: activePeople.map((p) => initialMember(p.id)),
    }),
  );
  assert.equal((await projetosService.listTeam(batch.id)).length, 2);
  const teamBeforeEdit = await projetosService.listTeam(batch.id);
  await projetosService.update(batch.id, { nome: "Cadastro alterado sem perder equipe" });
  assert.deepEqual(await projetosService.listTeam(batch.id), teamBeforeEdit);
  const prepared = await projetosService.create(
    projetoCreateSchema.parse({ ...projectData, nome: "Planejamento sem equipe" }),
  );
  await tarefasRepository.save(null, {
    projetoId: prepared.id,
    titulo: "Pode planejar antes de alocar equipe",
  });
  const newHours = {
    projetoId: prepared.id,
    colaboradorId: activePeople[0].id,
    data: new Date("2026-10-01"),
    horas: 1,
    descricao: "Operação após definir equipe",
    status: "PENDENTE",
  };
  await assert.rejects(apontamentosService.create(newHours), { statusCode: 409 });
  const participation = await projetosService.addTeamMember(prepared.id, {
    ...initialMember(activePeople[1].id),
    dataEntrada: new Date("2026-10-01"),
  });
  await assert.rejects(apontamentosService.create({ ...newHours, data: new Date("2026-09-30") }), {
    statusCode: 409,
  });
  const recorded = await apontamentosService.create(newHours);
  assert.equal(Number(recorded.horas), 1);
  await projetosService.updateTeamMember(prepared.id, participation.id, {
    dataSaida: new Date("2026-10-01"),
  });
  await assert.rejects(apontamentosService.create({ ...newHours, data: new Date("2026-10-02") }), {
    statusCode: 409,
  });
  await apontamentosService.update(recorded.id, { descricao: "Correção histórica preservada" });
  assert.equal(
    (await apontamentosService.getById(recorded.id)).descricao,
    "Correção histórica preservada",
  );
  console.log(
    "OK: todas as tabelas populadas, cenários financeiros conciliados, tarefas compartilhadas, pendências, histórico, reexecução sem duplicatas e ajustes manuais preservados.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-seed-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
