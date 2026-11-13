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
const schema = `reports_test_${Date.now().toString(36)}`;
if (!/^reports_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
const admin = new PrismaClient();
let client;
let created = false;
const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-reports-"));
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
    { cwd: root, env: process.env, encoding: "utf8", windowsHide: true },
  );
  if (migration.status !== 0)
    throw new Error(
      `Falha ao preparar o schema temporário:\n${migration.stdout}\n${migration.stderr}`,
    );
  ({ default: client } = await import("../src/config/prisma.js"));
  const { seedDemo } = await import("../prisma/seed-demo.js");
  await seedDemo(client);
  const { relatoriosGeradosService: service, VERSAO_RELATORIO } =
    await import("../src/services/relatoriosGeradosService.js");
  const { relatorioCreateSchema } = await import("../src/schemas/relatoriosSchemas.js");
  const { dashboardService } = await import("../src/services/dashboardService.js");
  const { exclusaoProjetosRepository } =
    await import("../src/repositories/exclusaoProjetosRepository.js");
  const { lerPasta } = await import("../src/utils/planilha.js");
  const user = await client.usuario.findUnique({ where: { email: "admin@sistema.local" } });
  const gerar = (dados) => service.gerar(relatorioCreateSchema.parse(dados), user);
  const portal = await client.projeto.findFirst({ where: { nome: "Portal do Cliente (demo)" } });
  const todos = ["PROJETOS", "CLIENTES", "HORAS", "CUSTO", "INCONSISTENCIAS"];

  // A busca por cliente inclui os projetos dele; escolhas repetidas não duplicam dados.
  const porCliente = await gerar({
    clienteIds: [portal.clienteId],
    projetoIds: [portal.id],
    blocos: todos,
  });
  const projetosCliente = await client.projeto.findMany({ where: { clienteId: portal.clienteId } });
  const painelCliente = await dashboardService.get({
    projetoIds: projetosCliente.map((p) => p.id),
  });
  assert.deepEqual(
    porCliente.filtros.projetoIds,
    projetosCliente.map((p) => p.id).sort((a, b) => a - b),
  );
  assert.equal(porCliente.conteudo.dados.CUSTO.total, painelCliente.resumo.custo);
  assert.equal(porCliente.conteudo.dados.HORAS.total, painelCliente.resumo.horas);
  assert.ok(porCliente.conteudo.projetos.every((p) => p.clienteId === portal.clienteId));
  const personalizado = await gerar({ projetoIds: [portal.id], blocos: ["HORAS", "CUSTO"] });
  assert.notEqual(personalizado.id, porCliente.id);
  assert.equal(personalizado.conteudo.dados.HORAS.total, 22);
  assert.deepEqual((await service.buscar(porCliente.id)).conteudo, porCliente.conteudo);

  // Os números da fotografia são os mesmos do dashboard no mesmo recorte.
  const doPortal = await gerar({ projetoIds: [portal.id], blocos: todos });
  const painel = await dashboardService.get({ projetoIds: [portal.id] });
  assert.equal(doPortal.autor, "admin");
  assert.equal(doPortal.versao, VERSAO_RELATORIO);
  assert.deepEqual(doPortal.blocos, todos);
  assert.equal(doPortal.conteudo.dados.CUSTO.total, 1212);
  assert.equal(doPortal.conteudo.dados.CUSTO.total, painel.resumo.custo);
  assert.equal(doPortal.conteudo.dados.HORAS.total, 22);
  assert.equal(doPortal.conteudo.dados.PROJETOS.linhas[0].assertividade, 200);
  assert.equal(
    doPortal.conteudo.dados.HORAS.porColaborador.reduce((total, row) => total + row.horas, 0),
    22,
  );
  assert.equal(doPortal.conteudo.dados.INCONSISTENCIAS.total, painel.ocorrencias.length);
  assert.deepEqual(
    await client.projetoRelatorio.findMany({ where: { relatorioId: doPortal.id } }),
    [{ projetoId: portal.id, relatorioId: doPortal.id }],
  );

  // Só período: entram os projetos com dados no período, de qualquer estado.
  const outubro = await gerar({
    dataInicio: "2026-10-01",
    dataFim: "2026-10-31",
    blocos: ["HORAS", "CUSTO"],
  });
  assert.deepEqual(Object.keys(outubro.conteudo.dados).sort(), ["CUSTO", "HORAS"]);
  assert.equal(outubro.conteudo.dados.HORAS.total, 46);
  assert.equal(outubro.conteudo.dados.CUSTO.assertividadeMedia, null);
  assert.equal(
    await client.projetoRelatorio.count({ where: { relatorioId: outubro.id } }),
    outubro.conteudo.projetos.length,
  );
  await assert.rejects(gerar({ dataInicio: "2030-01-01", blocos: ["HORAS"] }), {
    statusCode: 422,
  });
  await assert.rejects(gerar({ projetoIds: [99999999], blocos: ["HORAS"] }), {
    statusCode: 400,
  });

  // A fotografia não muda com dados posteriores; um novo relatório mostra o valor atual.
  const entrada = await client.apontamentoHora.findFirst({
    where: { descricao: "Demonstração: portal-login-dev" },
  });
  await client.apontamentoHora.update({ where: { id: entrada.id }, data: { status: "APROVADO" } });
  await client.apontamentoHora.update({ where: { id: entrada.id }, data: { horas: 10 } });
  const reaberto = await service.buscar(doPortal.id);
  assert.deepEqual(reaberto.conteudo, doPortal.conteudo);
  assert.equal(reaberto.conteudo.dados.CUSTO.total, 1212);
  assert.equal(
    (await gerar({ projetoIds: [portal.id], blocos: ["CUSTO"] })).conteudo.dados.CUSTO.total,
    1317,
  );
  await assert.rejects(service.buscar(99999999), { statusCode: 404 });

  // O banco protege a cópia gravada e as referências, mesmo fora da API.
  await assert.rejects(
    client.relatorioGerado.update({ where: { id: doPortal.id }, data: { versao: 2 } }),
    /CODEBI_RELATORIO_IMUTAVEL/,
  );
  await assert.rejects(
    client.relatorioGerado.delete({ where: { id: doPortal.id } }),
    /CODEBI_RELATORIO_IMUTAVEL/,
  );
  await assert.rejects(
    client.projetoRelatorio.deleteMany({ where: { relatorioId: doPortal.id } }),
    /CODEBI_RELATORIO_IMUTAVEL/,
  );
  await assert.rejects(
    client.relatorioGerado.create({
      data: { filtros: {}, blocos: [], conteudo: {}, criadoPorId: user.id },
    }),
  );

  // Projeto sem nenhum outro vínculo fica protegido só por ter entrado num relatório.
  const vazio = await client.projeto.create({
    data: {
      nome: "Projeto só no relatório",
      clienteId: portal.clienteId,
      tipoContrato: portal.tipoContrato,
      horasContratadas: 1,
      valorProjeto: 100,
      dataInicio: new Date("2026-01-01"),
    },
  });
  assert.equal((await exclusaoProjetosRepository.inspect(vazio.id)).podeExcluir, true);
  const soDoVazio = await gerar({ projetoIds: [vazio.id], blocos: ["PROJETOS"] });
  assert.equal(soDoVazio.conteudo.dados.PROJETOS.linhas[0].horas, 0);
  const info = await exclusaoProjetosRepository.inspect(vazio.id);
  assert.equal(info.podeExcluir, false);
  assert.equal(info.vinculos.relatorios, 1);
  await assert.rejects(exclusaoProjetosRepository.remove(vazio.id), { statusCode: 409 });

  // API autenticada.
  const { app } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const { createTestSession } = await import("./helpers/session-fixture.mjs");
  const token = await createTestSession(client, user, env.jwtSecret);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/relatorios`;
  const request = (sufixo, { method = "GET", body, autenticado = true } = {}) =>
    fetch(url + sufixo, {
      method,
      headers: {
        ...(autenticado ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    const corpo = { projetoIds: [portal.id], dataInicio: null, dataFim: null, blocos: ["HORAS"] };
    assert.equal(
      (await request("", { method: "POST", body: corpo, autenticado: false })).status,
      401,
    );
    assert.equal((await request(`/${doPortal.id}`, { autenticado: false })).status, 401);
    const criado = await request("", { method: "POST", body: corpo });
    assert.equal(criado.status, 201);
    const json = await criado.json();
    assert.deepEqual(json.blocos, ["HORAS"]);
    assert.equal(json.autor, "admin");
    const lido = await request(`/${json.id}`);
    assert.equal(lido.status, 200);
    assert.deepEqual((await lido.json()).conteudo, json.conteudo);
    assert.equal((await request("/99999999")).status, 404);
    // Arquivos: leem a fotografia, não os dados atuais (o Portal já mudou para R$ 1.317).
    const pdf = await request(`/${doPortal.id}/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(
      pdf.headers.get("content-disposition"),
      new RegExp(`relatorio-${doPortal.id}-portal-do-cliente-demo-todos-os-periodos\\.pdf`),
    );
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    const xlsx = await request(`/${doPortal.id}/xlsx`);
    assert.equal(xlsx.status, 200);
    const pasta = await lerPasta(Buffer.from(await xlsx.arrayBuffer()));
    assert.deepEqual(
      pasta.worksheets.map((aba) => aba.name),
      [
        "Relatório",
        "Projetos",
        "Clientes",
        "Horas totais",
        "Horas por colaborador",
        "Custo total",
        "Inconsistências",
      ],
    );
    assert.equal(pasta.getWorksheet("Custo total").getCell("B1").value, 1212);
    assert.equal(pasta.getWorksheet("Projetos").getCell("H2").value, 1212);
    const soHoras = await lerPasta(
      Buffer.from(await (await request(`/${json.id}/xlsx`)).arrayBuffer()),
    );
    assert.deepEqual(
      soHoras.worksheets.map((aba) => aba.name),
      ["Relatório", "Horas totais", "Horas por colaborador"],
      "Só os blocos escolhidos.",
    );
    const porClienteArquivo = await request(`/${porCliente.id}/pdf`);
    assert.match(porClienteArquivo.headers.get("content-disposition"), /relatorio-\d+-cliente-/);
    assert.equal((await request(`/${doPortal.id}/pdf`, { autenticado: false })).status, 401);
    assert.equal((await request(`/${doPortal.id}/xlsx`, { autenticado: false })).status, 401);
    assert.equal((await request("/99999999/pdf")).status, 404);
    assert.equal((await request("/99999999/xlsx")).status, 404);
    // Histórico: do mais recente para o mais antigo, com os downloads de cada relatório.
    const totalGerados = await client.relatorioGerado.count();
    const historico = await (await request("?porPagina=50")).json();
    assert.equal(historico.total, totalGerados);
    assert.equal(
      historico.itens[0].id,
      (await client.relatorioGerado.findFirst({ orderBy: { id: "desc" } })).id,
    );
    assert.ok(
      historico.itens.every((item, i, lista) => i === 0 || lista[i - 1].criadoEm >= item.criadoEm),
    );
    const linhaPortal = historico.itens.find((item) => item.id === doPortal.id);
    assert.deepEqual(
      { PDF: linhaPortal.exportacoes.PDF, XLSX: linhaPortal.exportacoes.XLSX },
      { PDF: 1, XLSX: 1 },
      "Só os downloads concluídos contam; 401 e 404 não.",
    );
    assert.equal(linhaPortal.autor, "admin");
    assert.equal("conteudo" in linhaPortal, false);
    const linhaCliente = historico.itens.find((item) => item.id === porCliente.id);
    assert.equal(linhaCliente.clientes.length, 1);
    const primeiraPagina = await (await request("?porPagina=2")).json();
    assert.equal(primeiraPagina.itens.length, 2);
    assert.equal(primeiraPagina.paginas, Math.ceil(totalGerados / 2));
    const segunda = await (await request("?porPagina=2&pagina=2")).json();
    assert.ok(
      segunda.itens.every((item) => !primeiraPagina.itens.some((row) => row.id === item.id)),
    );
    const doVazio = await (await request(`?projetoId=${vazio.id}`)).json();
    assert.deepEqual(
      doVazio.itens.map((item) => item.id),
      [soDoVazio.id],
      "Filtra pelos projetos registrados na fotografia.",
    );
    assert.equal((await (await request(`?autorId=${user.id}`)).json()).total, totalGerados);
    assert.equal((await (await request("?geradoAte=2000-01-01")).json()).total, 0);
    assert.equal((await request("?porPagina=51")).status, 400);
    assert.equal((await request("", { autenticado: false })).status, 401);
    await assert.rejects(
      client.relatorioExportacao.deleteMany({ where: { relatorioId: doPortal.id } }),
      /CODEBI_EXPORTACAO_IMUTAVEL/,
    );
    assert.equal((await request("/abc")).status, 400);
    assert.equal(
      (await request("", { method: "POST", body: { blocos: ["HORAS"] } })).status,
      400,
      "Sem filtro.",
    );
    assert.equal(
      (await request("", { method: "POST", body: { projetoIds: [portal.id], blocos: [] } })).status,
      400,
      "Sem bloco.",
    );
    assert.equal(
      (
        await request("", {
          method: "POST",
          body: { dataInicio: "2030-01-01", blocos: ["HORAS"] },
        })
      ).status,
      422,
      "Recorte vazio não gera relatório.",
    );
    // A exportação em Excel existente continua respondendo na mesma rota.
    assert.equal((await request(`/indicadores.xlsx?projetoIds=${portal.id}`)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "OK: fotografia com os números do dashboard, blocos escolhidos, recorte por período, recorte vazio recusado, cópia imutável no banco, projetos protegidos contra exclusão, PDF e Excel lidos da fotografia, histórico paginado com os downloads e API autenticada.",
  );
} finally {
  await client?.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  const resolvedProject = path.resolve(temporaryProject);
  if (
    path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
    path.basename(resolvedProject).startsWith("code-bi-reports-")
  )
    rmSync(resolvedProject, { recursive: true, force: true });
}
