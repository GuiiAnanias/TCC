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
const schema = `invoiced_cost_test_${Date.now().toString(36)}`;
if (!/^invoiced_cost_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-cost-"));
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
    (item) => item.isDirectory() && item.name !== "20261103020000_custos_faturados_preservados",
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
  const { apontamentosService: hours } = await import("../src/services/apontamentosService.js");
  const { projetosService: teams } = await import("../src/services/projetosService.js");
  const { bonificacoesPapeisRepository: bonuses } =
    await import("../src/repositories/bonificacoesPapeisRepository.js");
  const { dashboardService } = await import("../src/services/dashboardService.js");
  const { relatoriosService } = await import("../src/services/relatoriosService.js");
  const { importacaoApontamentosService: imports, COLUNAS } =
    await import("../src/services/importacaoApontamentosService.js");
  const { default: ExcelJS } = await import("exceljs");
  const customer = await client.cliente.create({ data: { nome: "Cliente de custos" } });
  const project = await client.projeto.create({
    data: {
      nome: "Projeto de custos",
      clienteId: customer.id,
      tipoContrato: "ESCOPO_SEMIABERTO",
      horasContratadas: 100,
      valorProjeto: 1000,
      dataInicio: new Date("2026-01-01"),
    },
  });
  const people = await Promise.all(
    [1, 2].map((n) =>
      client.colaborador.create({
        data: {
          nomeCompleto: `Pessoa ${n}`,
          email: `cost${n}@example.local`,
          cargo: "Dev",
          departamento: "TI",
        },
      }),
    ),
  );
  const rate = await client.itemTabelaRemuneracao.create({
    data: { nivel: "Pleno I", valorHora: 100 },
  });
  const finance = (person) => ({
    colaboradorId: person.id,
    itemTabelaId: rate.id,
    valorHoraAplicado: 100,
    nivelAplicado: rate.nivel,
    dataInicio: new Date("2026-01-01"),
  });
  await client.configuracaoFinanceira.create({ data: finance(people[0]) });
  const team = await teams.addTeamMember(project.id, {
    colaboradorId: people[0].id,
    papel: "Dev",
    dataEntrada: new Date("2026-01-01"),
  });
  await bonuses.createVersion({ papel: "Dev", percentual: 50, dataInicio: new Date("2026-01-01") });
  // Dados faturados anteriores à migração: um completo e outro sem parâmetros.
  const legacy = await client.$queryRaw`
    INSERT INTO "apontamentos_horas" ("colaboradorId","projetoId",data,horas,status,descricao,"updatedAt")
    VALUES (${people[0].id},${project.id},'2026-01-10',1,'FATURADO','Legado completo',NOW()),
           (${people[1].id},${project.id},'2026-01-10',1,'FATURADO','Legado incompleto',NOW()) RETURNING id`;
  const migrationName = "20261103020000_custos_faturados_preservados";
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
  const ambiguous = await client.bonificacaoPapel.create({
    data: {
      papel: "Dev",
      percentual: 60,
      dataInicio: new Date("2026-01-02"),
      dataFim: new Date("2026-01-20"),
    },
  });
  assert.notEqual(
    runMigration("deploy").status,
    0,
    "Ambiguidade deve impedir consolidação automática",
  );
  const [{ total }] =
    await client.$queryRaw`SELECT count(*)::int AS total FROM "apontamentos_horas"`;
  assert.equal(total, 2, "Falha na migração preserva os registros anteriores");
  await client.bonificacaoPapel.delete({ where: { id: ambiguous.id } });
  assert.equal(runMigration("resolve", "--rolled-back", migrationName).status, 0);
  const migrated = runMigration("deploy");
  assert.equal(migrated.status, 0, migrated.stderr + migrated.stdout);
  const find = (id) => client.apontamentoHora.findUnique({ where: { id } });
  const saved = await find(legacy[0].id);
  assert.equal(saved.custoConsolidado.custo, 150);
  assert.equal(saved.custoConsolidado.origem, "MIGRACAO_VALOR_ATUAL");
  assert.equal(saved.historicoCustos.length, 1);
  assert.equal((await find(legacy[1].id)).custoConsolidado.semCusto, true);
  assert.ok((await find(legacy[1].id)).custoConsolidado.pendencia);
  const assertConflict = (operation) => assert.rejects(operation, { statusCode: 409 });
  await assertConflict(
    bonuses.createVersion({ papel: "Dev", percentual: 75, dataInicio: new Date("2026-01-05") }),
  );
  await assertConflict(
    teams.updateTeamMember(project.id, team.id, {
      papel: "QA",
      dataVigencia: new Date("2026-01-05"),
    }),
  );
  await assertConflict(
    teams.updateTeamMember(project.id, team.id, { dataEntrada: new Date("2026-01-11") }),
  );
  assert.equal((await find(saved.id)).custoConsolidado.custo, 150);
  assert.equal(
    await client.projetoColaborador.count(),
    1,
    "Troca recusada não deixa vínculo pela metade",
  );
  const entry = (person, date, status = "FATURADO") => ({
    colaboradorId: person.id,
    projetoId: project.id,
    data: new Date(date),
    horas: 1,
    status,
    descricao: "Hora de teste",
  });
  const billed = await hours.create(entry(people[0], "2026-01-11"));
  assert.equal(billed.custoConsolidado.custo, 150);
  await assertConflict(hours.create(entry(people[1], "2026-01-11")));
  const pending = await hours.create(entry(people[1], "2026-01-11", "APROVADO"));
  await assertConflict(hours.update(pending.id, { status: "FATURADO" }));
  assert.equal((await find(pending.id)).status, "APROVADO");
  const { env } = await import("../src/config/env.js");
  env.jwtSecret = "segredo-somente-teste-custos";
  const { createTestSession } = await import("./helpers/session-fixture.mjs");
  const { app } = await import("../src/app.js");
  const user = await client.usuario.create({
    data: {
      nomeUsuario: "teste-custos",
      email: "custos@example.local",
      senhaHash: "hash-de-teste",
    },
  });
  const token = await createTestSession(client, user, env.jwtSecret);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/apontamentos/${pending.id}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FATURADO" }),
      },
    );
    assert.equal(response.status, 409);
    const publicError = await response.json();
    assert.match(publicError.message, /Não é possível faturar/);
    assert.equal(publicError.stack, undefined);
    assert.ok(!JSON.stringify(publicError).includes("Prisma"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  await assert.rejects(
    client.apontamentoHora.update({
      where: { id: saved.id },
      data: { custoConsolidado: { custo: 1 } },
    }),
  );
  await assert.rejects(client.apontamentoHora.delete({ where: { id: saved.id } }));
  // Correção explícita preserva a versão anterior e registra nova apuração.
  await hours.update(saved.id, { status: "APROVADO" });
  await hours.update(billed.id, { status: "APROVADO" });
  await bonuses.createVersion({ papel: "Dev", percentual: 75, dataInicio: new Date("2026-01-05") });
  const revised = await hours.update(saved.id, { status: "FATURADO" });
  assert.equal(revised.custoConsolidado.custo, 175);
  assert.equal(revised.custoConsolidado.versao, 2);
  assert.deepEqual(
    revised.historicoCustos.map((x) => x.custo),
    [150, 175],
  );
  // Preencher pendência antiga não reinterpreta silenciosamente a consolidação.
  await client.configuracaoFinanceira.create({ data: finance(people[1]) });
  await teams.addTeamMember(project.id, {
    colaboradorId: people[1].id,
    papel: "QA",
    dataEntrada: new Date("2026-01-01"),
  });
  assert.equal((await find(legacy[1].id)).custoConsolidado.semCusto, true);
  await hours.update(legacy[1].id, { status: "APROVADO" });
  const repaired = await hours.update(legacy[1].id, { status: "FATURADO" });
  assert.equal(repaired.custoConsolidado.custo, 100);
  assert.equal(repaired.historicoCustos.length, 2);
  // Importação como Faturado consolida no mesmo ponto, sem depender do frontend.
  const workbook = async (person, date, status, description) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Apontamentos");
    ws.addRow(COLUNAS.map((x) => x.titulo));
    ws.addRow([new Date(date), person.email, project.nome, null, 1, status, description]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  };
  const buffer = await workbook(people[0], "2026-01-12", "Faturado", "Excel faturado");
  assert.equal((await imports.validar(buffer)).resumo.comErro, 0);
  await imports.importar(buffer);
  const imported = await client.apontamentoHora.findFirst({
    where: { descricao: "Excel faturado" },
  });
  assert.equal(imported.custoConsolidado.custo, 175);
  // Corrigir parâmetros de uma hora futura pode concorrer com seu faturamento:
  // somente uma composição coerente vence; não há custo faturado divergente.
  const racing = await hours.create(entry(people[0], "2026-01-20", "APROVADO"));
  const race = await Promise.allSettled([
    hours.update(racing.id, { status: "FATURADO" }),
    bonuses.createVersion({ papel: "Dev", percentual: 80, dataInicio: new Date("2026-01-20") }),
  ]);
  const final = await find(racing.id);
  const rule = await client.bonificacaoPapel.findFirst({ where: { papel: "Dev", dataFim: null } });
  if (final.status === "FATURADO")
    assert.equal(final.custoConsolidado.percentual, Number(rule.percentual));
  assert.ok(race.some((x) => x.status === "fulfilled"));
  // Total, detalhamento e exportação usam os mesmos custos preservados.
  const filters = {
    projetoId: project.id,
    dataInicio: new Date("2026-01-10"),
    dataFim: new Date("2026-01-12"),
  };
  const report = await dashboardService.report(filters);
  assert.equal(report.apontamentos.find((x) => x.id === saved.id).custo, 175);
  assert.equal(report.apontamentos.find((x) => x.id === imported.id).custo, 175);
  const { arquivo } = await relatoriosService.indicadoresXlsx(filters);
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.load(arquivo);
  const sheet = exported.getWorksheet("Apontamentos");
  assert.ok(sheet);
  let invoiceCost;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === imported.id) invoiceCost = row.getCell(17).value;
  });
  assert.equal(invoiceCost, 175, "A célula de custo exportada preserva o faturamento");
  assert.equal(
    report.resumo.custo,
    report.apontamentos.reduce((total, row) => total + row.custo, 0),
  );
  const individual = await dashboardService.project(project.id, filters);
  assert.equal(individual.resumo.custo, report.resumo.custo);
  console.log(
    "OK: migração de faturados completos/incompletos, bloqueio retroativo, correção versionada, falta de parâmetros, imutabilidade SQL, Excel, concorrência e conciliação.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-cost-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
