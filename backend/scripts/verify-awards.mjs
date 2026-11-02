// Integração em schema temporário. Nunca usa public para as operações de teste.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const root = fileURLToPath(new URL("../", import.meta.url));
const originalUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(originalUrl.hostname))
  throw new Error("Este teste aceita somente PostgreSQL local.");
const schema = `awards_step6_test_${Date.now().toString(36)}`;
if (!/^awards_step6_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-awards-"));
let client,
  created = false;
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  originalUrl.searchParams.set("schema", schema);
  process.env.DATABASE_URL = originalUrl.toString();
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
    { cwd: root, env: process.env, encoding: "utf8", windowsHide: true },
  );
  if (migration.status !== 0)
    throw new Error(`Falha nas migrações:\n${migration.stdout}\n${migration.stderr}`);
  ({ default: client } = await import("../src/config/prisma.js"));
  const { seedDemo } = await import("../prisma/seed-demo.js");
  const { premiacaoRepository: repository } =
    await import("../src/repositories/premiacaoRepository.js");
  const { premiacaoTemplates } = await import("../src/services/premiacaoRules.js");
  const { awardRuleSchema, awardCreateSchema, awardUpdateSchema } =
    await import("../src/schemas/premiacaoSchemas.js");
  const { dashboardService } = await import("../src/services/dashboardService.js");
  await seedDemo(client);
  const before = await dashboardService.get({});
  const user = await client.usuario.findFirst();
  const ana = await client.colaborador.findUnique({ where: { email: "ana.demo@exemplo.local" } });
  const portal = await client.projeto.findFirst({ where: { nome: "Portal do Cliente (demo)" } });
  assert.equal(await client.regraPremiacao.count(), 2);
  assert.equal(await client.avaliacaoPremiacao.count(), 2);
  const demoClosed = await client.avaliacaoPremiacao.findFirst({ where: { status: "CONCLUIDA" } });
  assert.equal(demoClosed.conteudo.resultado.percentualFinal, 4);
  assert.equal(demoClosed.conteudo.resultado.notaFinal, 9);
  const rule = await repository.createRule(
    awardRuleSchema.parse({ ...premiacaoTemplates.DEV, nome: "Dev — versão de teste" }),
    user,
  );
  const data = {
    projetoIds: [portal.id],
    sprintIds: [],
    respostas: [],
    percentualBase: 5,
    percentualInformado: null,
    justificativaPercentual: "",
    observacoes: "Base fictícia de teste",
  };
  const input = awardCreateSchema.parse({
    colaboradorId: ana.id,
    competencia: "2026-09",
    regraId: rule.id,
    dados: data,
  });
  let draft = await repository.create(input, user);
  assert.equal(draft.conteudo.resultado.notaFinal, null);
  const task = draft.conteudo.base.tarefas.find((row) => row.titulo === "Tela de login");
  assert.equal(task.horasNoRecorte, 8);
  assert.equal(task.horasTotais, 14);
  assert.equal(draft.conteudo.base.indicadores.assertividadeTarefasContexto, 57.14);
  await assert.rejects(repository.close(draft.id, { revisao: 1 }, user), /Confira todos/);
  await assert.rejects(repository.create(input, user), (err) => err.code === "P2002");
  data.respostas = rule.definicao.criterios.map((row) => ({
    chave: row.chave,
    situacao: row.chave === "estimativas" ? "SIM" : "NAO",
    evidencia: "Conferência manual de teste",
  }));
  draft = await repository.update(
    draft.id,
    awardUpdateSchema.parse({ revisao: draft.revisao, dados: data }),
    user,
  );
  assert.equal(draft.conteudo.resultado.notaFinal, 9);
  assert.equal(draft.conteudo.resultado.percentualFinal, null);
  await assert.rejects(
    repository.update(draft.id, { revisao: 1, dados: data }, user),
    /outra sessão/,
  );
  await assert.rejects(
    repository.update(
      draft.id,
      {
        revisao: draft.revisao,
        dados: { ...data, respostas: [{ chave: "inventado", situacao: "NAO", evidencia: "" }] },
      },
      user,
    ),
    /não pertence/,
  );
  const mobileSprint = await client.sprint.findFirst({ where: { projetoId: { not: portal.id } } });
  await assert.rejects(
    repository.update(
      draft.id,
      { revisao: draft.revisao, dados: { ...data, sprintIds: [mobileSprint.id] } },
      user,
    ),
    /precisam pertencer/,
  );
  // Fechar sem faixas preserva a nota, sem inventar percentual.
  const closed = await repository.close(draft.id, { revisao: draft.revisao }, user);
  assert.equal(closed.conteudo.resultado.percentualFinal, null);
  assert.equal(closed.status, "CONCLUIDA");
  await assert.rejects(
    repository.update(closed.id, { revisao: closed.revisao, dados: data }, user),
    /concluída/,
  );
  await assert.rejects(
    client.avaliacaoPremiacao.update({ where: { id: closed.id }, data: { conteudo: {} } }),
  );
  await assert.rejects(client.avaliacaoPremiacao.delete({ where: { id: closed.id } }));
  await assert.rejects(
    client.regraPremiacao.update({ where: { id: rule.id }, data: { nome: "Alteração proibida" } }),
  );
  const rule2 = await repository.createRule(
    awardRuleSchema.parse({
      ...premiacaoTemplates.DEV,
      nome: "Nova versão com faixa de teste",
      faixas: [{ minimo: 9, maximo: 10, percentual: 80 }],
    }),
    user,
  );
  let revision = await repository.create(
    { ...input, anteriorId: closed.id, regraId: rule2.id, dados: data },
    user,
  );
  assert.equal(revision.versao, 2);
  assert.equal(revision.conteudo.resultado.percentualFinal, 4);
  assert.equal((await repository.find(closed.id)).proxima.id, revision.id);
  await assert.rejects(
    repository.create({ ...input, anteriorId: closed.id }, user),
    /última versão/,
  );
  const snapshot = JSON.stringify((await repository.find(closed.id)).conteudo);
  await client.tarefa.update({
    where: { id: task.id },
    data: { titulo: "Novo título", minutosEstimados: 1000 },
  });
  assert.equal(JSON.stringify((await repository.find(closed.id)).conteudo), snapshot);
  const after = await dashboardService.get({});
  for (const field of ["horas", "custo", "bonificacao", "custoBase"])
    assert.equal(
      after.resumo[field],
      before.resumo[field],
      "Premiação não altera custos nem horas",
    );
  // Uma única escrita vence; a segunda sessão recebe conflito e não sobrescreve.
  const saves = await Promise.allSettled(
    [1, 2].map((n) =>
      repository.update(
        revision.id,
        { revisao: revision.revisao, dados: { ...data, observacoes: `Sessão ${n}` } },
        user,
      ),
    ),
  );
  assert.equal(saves.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(saves.filter((row) => row.status === "rejected").length, 1);
  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { default: jwt } = await import("jsonwebtoken");
  const token = jwt.sign({}, env.jwtSecret, { subject: String(user.id), expiresIn: "5m" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/premiacoes`;
  const request = (suffix = "", method = "GET", body) =>
    fetch(url + suffix, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    for (const suffix of [
      "",
      "/regras",
      "/modelos",
      `/${closed.id}`,
      "?categoria=DEV&competencia=2026-09",
    ])
      assert.equal((await request(suffix)).status, 200, suffix);
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await request("/99999999")).status, 404);
    assert.equal((await request("?competencia=2026-13")).status, 400);
    assert.equal(
      (
        await request("/regras", "POST", {
          ...premiacaoTemplates.DEV,
          faixas: [{ minimo: 5, maximo: 0, percentual: 101 }],
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(`/${revision.id}`, "PUT", { revisao: 1, dados: data })).status,
      409,
    );
    assert.equal(
      (
        await request("", "POST", {
          ...input,
          dados: { ...data, percentualInformado: 90, justificativaPercentual: "" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/regras", "POST", {
          ...premiacaoTemplates.PO_SM,
          nome: "PO — publicado por HTTP",
        })
      ).status,
      201,
    );
    const posted = await request("", "POST", {
      ...input,
      competencia: "2026-08",
      dados: {
        ...data,
        percentualInformado: 80,
        justificativaPercentual: "Exemplo informado manualmente",
      },
    });
    assert.equal(posted.status, 201);
    const award = await posted.json();
    assert.equal(award.conteudo.resultado.percentualFinal, 4);
    assert.equal(
      (await request(`/${award.id}/concluir`, "POST", { revisao: award.revisao })).status,
      200,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "OK: critérios, notas, percentuais, base compartilhada, faixas ausentes, revisões, imutabilidade SQL, concorrência, custo preservado, seed e API autenticada.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const target = path.resolve(temporaryProject);
  if (
    path.dirname(target) === path.resolve(tmpdir()) &&
    path.basename(target).startsWith("code-bi-awards-")
  )
    rmSync(target, { recursive: true, force: true });
}
