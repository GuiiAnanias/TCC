// Integração com PostgreSQL local em schema temporário; não modifica a base da interface.
// Confere pela API autenticada: modelo, prévia, importação tudo-ou-nada, importação
// repetida, limite de 24 h, importações simultâneas e o relatório em Excel.
import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function abrir(resposta) {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(Buffer.from(await resposta.arrayBuffer()));
  return pasta;
}
const valorAoLado = (aba, rotulo) => {
  let valor;
  aba.eachRow((linha) => {
    if (linha.getCell(1).value === rotulo) valor = linha.getCell(2).value;
  });
  return valor;
};

/** Fluxo completo pela API. Supõe a base de demonstração (seed) já carregada. */
export async function verificarFluxoExcel({ client, baseUrl, token }) {
  const auth = { Authorization: `Bearer ${token}` };
  const enviar = (rota, corpo) =>
    fetch(`${baseUrl}${rota}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": XLSX },
      body: corpo,
    });
  const marca = `verify-excel-${Date.now().toString(36)}`;
  const contar = () =>
    client.apontamentoHora.count({ where: { descricao: { startsWith: marca } } });
  // Datas relativas a hoje (America/Sao_Paulo), sempre no passado.
  const hoje = new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())}T00:00:00.000Z`,
  );
  const diasAtras = (dias) => new Date(hoje.getTime() - dias * 86400000);

  for (const rota of ["/relatorios/indicadores.xlsx", "/importacoes/apontamentos/modelo"])
    assert.equal((await fetch(`${baseUrl}${rota}`)).status, 401, `${rota} exige login.`);

  const respostaModelo = await fetch(`${baseUrl}/importacoes/apontamentos/modelo`, {
    headers: auth,
  });
  assert.equal(respostaModelo.status, 200);
  assert.equal(respostaModelo.headers.get("content-type"), XLSX);
  assert.match(
    respostaModelo.headers.get("content-disposition"),
    /modelo-importacao-apontamentos\.xlsx/,
  );
  const modelo = await abrir(respostaModelo);
  assert.deepEqual(
    modelo.worksheets.map((aba) => aba.name),
    ["Instruções", "Apontamentos", "Listas"],
  );
  const listas = modelo.getWorksheet("Listas");
  const coluna = (numero) =>
    listas
      .getColumn(numero)
      .values.slice(2)
      .filter((valor) => valor != null);
  const emails = coluna(1);
  const projetos = coluna(4);
  assert.ok(emails.includes("ana.demo@exemplo.local"), "Listas traz os e-mails ativos.");
  const tarefa = { titulo: listas.getCell("G2").value, projeto: listas.getCell("H2").value };
  assert.ok(tarefa.titulo && projetos.includes(tarefa.projeto));

  async function planilha(linhas) {
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load(await modelo.xlsx.writeBuffer());
    const aba = pasta.getWorksheet("Apontamentos");
    linhas.forEach((valores, indice) => (aba.getRow(indice + 2).values = valores));
    return Buffer.from(await pasta.xlsx.writeBuffer());
  }

  // Prévia: confere e não grava.
  const valida = await planilha([
    [
      diasAtras(1),
      "ana.demo@exemplo.local",
      tarefa.projeto,
      tarefa.titulo,
      2.5,
      "Aprovado",
      `${marca} 1`,
    ],
    [diasAtras(2), "carla.demo@exemplo.local", projetos[0], null, "1,5", null, `${marca} 2`],
    [
      diasAtras(2),
      "bruno.demo@exemplo.local",
      projetos[0],
      null,
      "07:30",
      "Faturado",
      `${marca} 3`,
    ],
  ]);
  let resposta = await enviar("/importacoes/apontamentos/validacao", valida);
  const previa = await resposta.json();
  assert.equal(resposta.status, 200, JSON.stringify(previa));
  assert.deepEqual(previa.erros, []);
  assert.equal(previa.resumo.validas, 3);
  assert.equal(previa.resumo.horas, 11.5);
  assert.equal(await contar(), 0, "A prévia não grava.");

  // Importação grava as três linhas com os valores convertidos.
  resposta = await enviar("/importacoes/apontamentos", valida);
  const importacao = await resposta.json();
  assert.equal(resposta.status, 201, JSON.stringify(importacao));
  assert.equal(importacao.importados, 3);
  const gravados = await client.apontamentoHora.findMany({
    where: { descricao: { startsWith: marca } },
    include: { tarefa: { select: { titulo: true } } },
    orderBy: { descricao: "asc" },
  });
  assert.deepEqual(
    gravados.map((item) => [Number(item.horas), item.status, item.tarefa?.titulo ?? null]),
    [
      [2.5, "APROVADO", tarefa.titulo],
      [1.5, "PENDENTE", null],
      [7.5, "FATURADO", null],
    ],
  );

  // A mesma planilha de novo: nada é gravado.
  resposta = await enviar("/importacoes/apontamentos", valida);
  const repetida = await resposta.json();
  assert.equal(resposta.status, 422);
  assert.equal(repetida.details.resumo.comErro, 3);
  assert.match(repetida.details.erros[0].mensagem, /já existe no sistema/);
  assert.equal(await contar(), 3);

  // Uma linha válida e outra que passa de 24 h no dia: nenhuma é gravada.
  resposta = await enviar(
    "/importacoes/apontamentos",
    await planilha([
      [diasAtras(3), "diego.demo@exemplo.local", projetos[0], null, 16, null, `${marca} 4`],
      [diasAtras(3), "diego.demo@exemplo.local", projetos[0], null, 10, null, `${marca} 5`],
      [diasAtras(3), "eva.demo@exemplo.local", projetos[0], null, 1, null, `${marca} 6`],
    ]),
  );
  const excesso = await resposta.json();
  assert.equal(resposta.status, 422);
  assert.match(excesso.details.erros[0].mensagem, /ficaria com 26 h/);
  assert.equal(await contar(), 3, "Tudo ou nada.");

  // Duas importações simultâneas do mesmo arquivo: só uma grava.
  const simultanea = await planilha([
    [diasAtras(4), "ana.demo@exemplo.local", projetos[0], null, 4, null, `${marca} 7`],
    [diasAtras(4), "carla.demo@exemplo.local", projetos[0], null, 4, null, `${marca} 8`],
  ]);
  const respostas = await Promise.all([
    enviar("/importacoes/apontamentos", simultanea),
    enviar("/importacoes/apontamentos", simultanea),
  ]);
  assert.deepEqual(respostas.map((item) => item.status).sort(), [201, 422]);
  assert.equal(await contar(), 5);

  // Arquivos inválidos.
  resposta = await enviar("/importacoes/apontamentos/validacao", Buffer.from("data;horas"));
  assert.equal(resposta.status, 400);
  resposta = await enviar(
    "/importacoes/apontamentos/validacao",
    Buffer.alloc(6 * 1024 * 1024, 0x50),
  );
  assert.equal(resposta.status, 413);

  // Relatório: mesmo recorte e mesmos totais do dashboard.
  const inicio = diasAtras(10).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);
  const recorte = `dataInicio=${inicio}&dataFim=${fim}`;
  resposta = await fetch(`${baseUrl}/relatorios/indicadores.xlsx?${recorte}`, { headers: auth });
  assert.equal(resposta.status, 200);
  assert.match(
    resposta.headers.get("content-disposition"),
    /indicadores-codebi-\d{4}-\d{2}-\d{2}\.xlsx/,
  );
  assert.match(resposta.headers.get("access-control-expose-headers") ?? "", /Content-Disposition/i);
  const relatorio = await abrir(resposta);
  const dashboard = await (
    await fetch(`${baseUrl}/dashboard?${recorte}`, { headers: auth })
  ).json();
  const resumo = relatorio.getWorksheet("Resumo");
  assert.equal(valorAoLado(resumo, "Horas trabalhadas"), dashboard.resumo.horas);
  assert.equal(valorAoLado(resumo, "Custo total (R$)"), dashboard.resumo.custo);
  assert.equal(relatorio.getWorksheet("Projetos").rowCount, dashboard.projetos.length + 1);
  let importadosNoRelatorio = 0;
  relatorio.getWorksheet("Apontamentos").eachRow((linha) => {
    if (String(linha.getCell(19).value ?? "").startsWith(marca)) importadosNoRelatorio++;
  });
  assert.equal(importadosNoRelatorio, 5);
  resposta = await fetch(
    `${baseUrl}/relatorios/indicadores.xlsx?dataInicio=${fim}&dataFim=${inicio}`,
    {
      headers: auth,
    },
  );
  assert.equal(resposta.status, 400, "Período invertido é recusado como no dashboard.");
}

async function principal() {
  const { PrismaClient } = await import("@prisma/client");
  const root = fileURLToPath(new URL("../", import.meta.url));
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL para o PostgreSQL local.");
  const originalUrl = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(originalUrl.hostname))
    throw new Error("Este teste aceita somente PostgreSQL local.");
  const schema = `excel_test_${Date.now().toString(36)}`;
  if (!/^excel_test_[a-z0-9]+$/.test(schema)) throw new Error("Schema temporário inválido.");
  const admin = new PrismaClient();
  const temporaryProject = mkdtempSync(path.join(tmpdir(), "code-bi-excel-"));
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
      writeFileSync(
        path.join(target, "migration.sql"),
        sql.replaceAll('"public".', `"${schema}".`),
      );
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
    const { app } = await import("../src/app.js");
    const { env } = await import("../src/config/env.js");
    const { createTestSession } = await import("./helpers/session-fixture.mjs");
    const user = await client.usuario.create({
      data: {
        nomeUsuario: "excel-test",
        email: "excel-test@example.local",
        senhaHash: "test-only",
      },
    });
    const token = await createTestSession(client, user, env.jwtSecret);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      await verificarFluxoExcel({
        client,
        baseUrl: `http://127.0.0.1:${server.address().port}/api`,
        token,
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    console.log(
      "OK: modelo, prévia sem gravar, importação tudo-ou-nada, importação repetida, limite de 24 h, importações simultâneas, arquivos inválidos e relatório igual ao dashboard.",
    );
  } finally {
    await client?.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
    const resolvedProject = path.resolve(temporaryProject);
    if (
      path.dirname(resolvedProject) === path.resolve(tmpdir()) &&
      path.basename(resolvedProject).startsWith("code-bi-excel-")
    )
      rmSync(resolvedProject, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await principal();
