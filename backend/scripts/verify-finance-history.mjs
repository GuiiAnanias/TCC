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
const schema = `finance_step3_test_${Date.now().toString(36)}`;
if (!/^finance_step3_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
let client;
let created = false;
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-finance-"));
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
  const { configuracoesFinanceirasRepository: repo } =
    await import("../src/repositories/configuracoesFinanceirasRepository.js");
  const { configuracoesFinanceirasService: service } =
    await import("../src/services/configuracoesFinanceirasService.js");
  // Controle de custo do teste sem depender do módulo de dashboard, integrado depois.
  const preservedCost = async () => {
    const entries = await client.apontamentoHora.findMany({
      include: { colaborador: { include: { configuracoesFinanceiras: true } } },
    });
    return entries.reduce((sum, entry) => {
      const config = entry.colaborador.configuracoesFinanceiras
        .filter(
          (row) => row.dataInicio <= entry.data && (!row.dataFim || row.dataFim >= entry.data),
        )
        .sort((a, b) => b.dataInicio - a.dataInicio || b.id - a.id)[0];
      assert.ok(config, "As horas da fixture devem ter uma configuração financeira preservada.");
      return sum + Number(entry.horas) * Number(config.valorHoraAplicado);
    }, 0);
  };
  const { todayFinanceDate } = await import("../src/utils/financeDates.js");
  const author = await client.usuario.create({
    data: {
      nomeUsuario: "finance-test",
      email: "finance-test@example.local",
      senhaHash: "test-only",
    },
  });
  const person = await client.colaborador.create({
    data: {
      nomeCompleto: "Pessoa de teste",
      email: "person@example.local",
      cargo: "QA",
      departamento: "Qualidade",
    },
  });
  const customer = await client.cliente.create({ data: { nome: "Cliente de teste" } });
  const project = await client.projeto.create({
    data: {
      nome: "Projeto de teste",
      clienteId: customer.id,
      tipoContrato: "ESCOPO_SEMIABERTO",
      horasContratadas: 100,
      valorProjeto: 1000,
      dataInicio: new Date("2026-09-01"),
    },
  });
  const rate = await client.itemTabelaRemuneracao.create({
    data: { nivel: "Júnior II", valorHora: 45 },
  });
  const first = await service.createForColaborador(
    person.id,
    { itemTabelaId: rate.id, beneficios: 0, dataInicio: new Date("2026-09-01") },
    author.id,
  );
  const addHours = (data, horas) =>
    client.apontamentoHora.create({
      data: {
        colaboradorId: person.id,
        projetoId: project.id,
        data: new Date(data),
        horas,
        descricao: "Horas de teste",
      },
    });
  await addHours("2026-09-01", 8);
  assert.equal(await preservedCost(), 360);
  await client.itemTabelaRemuneracao.update({
    where: { id: rate.id },
    data: { valorHora: 90, nivel: "Pleno I" },
  });
  assert.equal(await preservedCost(), 360);
  assert.equal((await repo.findById(first.id)).nivelAplicado, "Júnior II");
  const second = await service.createForColaborador(
    person.id,
    {
      itemTabelaId: rate.id,
      beneficios: 10,
      dataInicio: new Date("2026-09-02"),
      motivo: "Reajuste de teste",
    },
    author.id,
  );
  assert.equal(second.valorHoraAplicado.toString(), "90");
  assert.equal(second.anteriorId, first.id);
  assert.equal(second.criadoPorId, author.id);
  assert.equal((await repo.findById(first.id)).dataFim.toISOString().slice(0, 10), "2026-09-01");
  await addHours("2026-09-02", 2);
  assert.equal(await preservedCost(), 540);
  await assert.rejects(
    service.updateForColaborador(person.id, first.id, { beneficios: 20 }, author.id),
    { statusCode: 409 },
  );
  await assert.rejects(
    service.updateForColaborador(person.id, second.id, { beneficios: 20 }, author.id),
    { statusCode: 409 },
  );
  await addHours("2026-09-10", 1);
  await assert.rejects(
    service.createForColaborador(
      person.id,
      { itemTabelaId: rate.id, beneficios: 0, dataInicio: new Date("2026-09-05") },
      author.id,
    ),
    { statusCode: 409 },
  );
  assert.equal((await repo.findById(second.id)).dataFim, null);
  // Datas e valores preservados também resistem à edição direta pelo Prisma.
  await assert.rejects(
    client.configuracaoFinanceira.update({
      where: { id: first.id },
      data: { valorHoraAplicado: 1 },
    }),
    /histórica/,
  );
  await assert.rejects(
    client.configuracaoFinanceira.update({ where: { id: first.id }, data: { dataFim: null } }),
    /encerrada/,
  );
  await assert.rejects(
    client.configuracaoFinanceira.delete({ where: { id: first.id } }),
    /excluído/,
  );
  const attempts = await Promise.allSettled(
    [1, 2].map(() =>
      service.createForColaborador(
        person.id,
        { itemTabelaId: rate.id, beneficios: 10, dataInicio: new Date("2026-10-01") },
        author.id,
      ),
    ),
  );
  assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    await client.configuracaoFinanceira.count({
      where: { colaboradorId: person.id, dataFim: null },
    }),
    1,
  );
  const active = await client.configuracaoFinanceira.findFirst({
    where: { colaboradorId: person.id, dataFim: null },
  });
  const nextDate = new Date(todayFinanceDate().getTime() + 86400000);
  await addHours(nextDate.toISOString(), 1);
  await assert.rejects(service.closeForColaborador(person.id, active.id, author.id), {
    statusCode: 409,
  });
  await assert.rejects(
    client.configuracaoFinanceira.update({
      where: { id: active.id },
      data: { dataFim: todayFinanceDate() },
    }),
    /cobertura/,
  );
  console.log(
    "OK: migrações, valores congelados, mudança de taxa, fronteira de vigência, autoria, bloqueio retroativo, triggers e concorrência.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-finance-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
