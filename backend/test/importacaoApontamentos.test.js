import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  COLUNAS,
  LIMITE_LINHAS,
  conferirConflitos,
  conferirCustos,
  importacaoApontamentosService as service,
  interpretarLinhas,
  lerPlanilha,
  montarModelo,
} from "../src/services/importacaoApontamentosService.js";
import { importacaoApontamentosRepository as repositorio } from "../src/repositories/importacaoApontamentosRepository.js";
import { apontamentosRepository } from "../src/repositories/apontamentosRepository.js";
import { tamanhoDescompactado } from "../src/utils/planilha.js";

const HOJE = "2026-10-20";
const ativo = { status: "ATIVO" };
const cadastros = {
  colaboradores: [
    { id: 1, nomeCompleto: "Ana Martins", email: "ana@codebi.local", status: "ATIVO" },
    { id: 2, nomeCompleto: "Bruno Costa", email: "bruno@codebi.local", status: "ATIVO" },
    { id: 3, nomeCompleto: "Carla Lima", email: "carla1@codebi.local", status: "ATIVO" },
    { id: 4, nomeCompleto: "Carla Lima", email: "carla2@codebi.local", status: "INATIVO" },
  ],
  projetos: [
    { id: 10, nome: "Portal do Cliente", status: "ATIVO", cliente: { nome: "Cliente A" } },
    { id: 11, nome: "Mobile", status: "ATIVO", cliente: { nome: "Cliente B" } },
    { id: 12, nome: "Mobile", status: "ATIVO", cliente: { nome: "Cliente C" } },
    { id: 13, nome: "Projeto Antigo", status: "INATIVO", cliente: { nome: "Cliente A" } },
  ],
  tarefas: [
    { id: 100, projetoId: 10, titulo: "Tela de login", statusRegistro: "ATIVO", projeto: ativo },
    { id: 101, projetoId: 11, titulo: "Tela de login", statusRegistro: "ATIVO", projeto: ativo },
    { id: 102, projetoId: 10, titulo: "Revisão", statusRegistro: "ATIVO", projeto: ativo },
    { id: 103, projetoId: 10, titulo: "Revisão", statusRegistro: "ATIVO", projeto: ativo },
    { id: 104, projetoId: 10, titulo: "Arquivada", statusRegistro: "INATIVO", projeto: ativo },
  ],
};

async function planilha(
  linhas,
  { cabecalho = COLUNAS.map((c) => c.titulo), aba = "Apontamentos" } = {},
) {
  const pasta = new ExcelJS.Workbook();
  pasta.addWorksheet("Instruções").getCell("A1").value = "Leia antes";
  const folha = pasta.addWorksheet(aba);
  folha.addRow(cabecalho);
  for (const linha of linhas) folha.addRow(linha);
  return Buffer.from(await pasta.xlsx.writeBuffer());
}

const linha = (valores) => ({ linha: 2, valores });
const base = {
  data: "15/10/2026",
  colaborador: "ana@codebi.local",
  projeto: "Portal do Cliente",
  tarefa: null,
  horas: 8,
  status: null,
  descricao: "Implementação da tela",
};
const interpretar = (valores) =>
  interpretarLinhas([linha({ ...base, ...valores })], cadastros, HOJE)[0];
const erroDe = (resultado, campo) => resultado.erros.find((erro) => erro.campo === campo)?.mensagem;

test("lê a aba Apontamentos com datas, links, texto rico, vírgula e hora do Excel", async () => {
  const buffer = await planilha([
    [
      new Date(Date.UTC(2026, 9, 15)),
      { text: "ana@codebi.local", hyperlink: "mailto:ana@codebi.local" },
      { richText: [{ text: "Portal " }, { text: "do Cliente" }] },
      "Tela de login",
      "7,5",
      "Aprovado",
      "Implementação",
    ],
    [],
    [
      "16/10/2026",
      "BRUNO@codebi.local",
      "Portal do Cliente",
      null,
      new Date(Date.UTC(1899, 11, 30, 8, 30)),
      null,
      "Testes",
    ],
  ]);
  const { aba, linhas } = await lerPlanilha(buffer);
  assert.equal(aba, "Apontamentos");
  assert.deepEqual(
    linhas.map((item) => item.linha),
    [2, 4],
    "Linhas vazias são ignoradas e a numeração segue a do Excel.",
  );
  const [primeira, segunda] = interpretarLinhas(linhas, cadastros, HOJE);
  assert.deepEqual(primeira.erros, []);
  assert.equal(primeira.data, "2026-10-15");
  assert.equal(primeira.colaborador.id, 1);
  assert.equal(primeira.projeto.id, 10);
  assert.equal(primeira.tarefa.id, 100);
  assert.equal(primeira.horas, 7.5);
  assert.equal(primeira.status, "APROVADO");
  assert.deepEqual(segunda.erros, []);
  assert.equal(segunda.colaborador.id, 2, "E-mail sem diferença de maiúsculas.");
  assert.equal(segunda.horas, 8.5, "08:30 vira 8,5 h.");
  assert.equal(segunda.status, "PENDENTE", "Status em branco entra como Pendente.");
});

test("aceita cabeçalho em outra ordem e com variações de nome", async () => {
  const buffer = await planilha(
    [["Revisão de código", 4, "ana@codebi.local", "Portal do Cliente", "2026-10-01"]],
    {
      cabecalho: ["descricao", "HORAS", "E-mail", "projeto", "Data"],
    },
  );
  const { linhas } = await lerPlanilha(buffer);
  const [item] = interpretarLinhas(linhas, cadastros, HOJE);
  assert.deepEqual(item.erros, []);
  assert.equal(item.descricao, "Revisão de código");
  assert.equal(item.data, "2026-10-01");
});

test("recusa arquivo que não é xlsx, sem colunas, sem linhas ou grande demais", async () => {
  await assert.rejects(lerPlanilha(Buffer.from("data;horas\n01/10/2026;8")), {
    statusCode: 400,
    message: /não é uma planilha \.xlsx/,
  });
  await assert.rejects(lerPlanilha(Buffer.from([0x50, 0x4b, 1, 2, 3])), { statusCode: 400 });
  await assert.rejects(lerPlanilha(await planilha([], { cabecalho: ["Data", "Projeto"] })), {
    statusCode: 400,
    message: /Faltam colunas obrigatórias.*E-mail do colaborador, Horas, Descrição/,
  });
  await assert.rejects(lerPlanilha(await planilha([])), {
    statusCode: 400,
    message: /Nenhum apontamento encontrado/,
  });
  await assert.rejects(
    lerPlanilha(
      await planilha([["Data"], ["Data"]], {
        cabecalho: ["Data", "Data", ...COLUNAS.slice(1).map((c) => c.titulo)],
      }),
    ),
    { statusCode: 400, message: /aparece duas vezes/ },
  );
  const muitas = Array.from({ length: LIMITE_LINHAS + 1 }, () => [
    "01/10/2026",
    "ana@codebi.local",
    "Portal do Cliente",
    null,
    1,
    null,
    "Linha",
  ]);
  await assert.rejects(lerPlanilha(await planilha(muitas)), {
    statusCode: 400,
    message: /limite é 2\.000/,
  });
  await assert.rejects(lerPlanilha(Buffer.alloc(5 * 1024 * 1024 + 1, 0x50)), { statusCode: 413 });
});

// ZIP mínimo com uma entrada que declara `tamanho` bytes descompactados.
function zipDeclarando(tamanho) {
  const nome = Buffer.from("xl/a.xml");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt32LE(tamanho, 24);
  central.writeUInt16LE(nome.length, 28);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(local.length + nome.length, 16);
  return Buffer.concat([local, nome, central, nome, fim]);
}

test("recusa bomba de ZIP antes de descompactar", async () => {
  await assert.rejects(lerPlanilha(zipDeclarando(200 * 1024 * 1024)), {
    statusCode: 413,
    message: /grande demais/,
  });
  await assert.rejects(lerPlanilha(zipDeclarando(1000)), { statusCode: 400 }, "ZIP sem planilha.");
  const tamanho = tamanhoDescompactado(await planilha([["01/10/2026"]]));
  assert.ok(tamanho > 1000 && tamanho < 100000, `Planilha comum: ${tamanho} bytes.`);
});

test("aponta o problema de cada campo na coluna certa", () => {
  assert.match(erroDe(interpretar({ data: "31/02/2026" }), "data"), /Data inválida/);
  assert.match(
    erroDe(interpretar({ data: "21/10/2026" }), "data"),
    /depois de hoje \(20\/10\/2026\)/,
  );
  assert.match(erroDe(interpretar({ data: "10/10/1999" }), "data"), /anterior a 2000/);
  assert.match(
    erroDe(interpretar({ colaborador: "ninguem@codebi.local" }), "colaborador"),
    /não encontrado/,
  );
  assert.match(
    erroDe(interpretar({ colaborador: "Carla Lima" }), "colaborador"),
    /mais de um colaborador/,
  );
  assert.equal(
    interpretar({ colaborador: "Ana Martins" }).colaborador.id,
    1,
    "Nome único também vale.",
  );
  assert.match(erroDe(interpretar({ projeto: "Mobile" }), "projeto"), /mais de um projeto/);
  assert.equal(interpretar({ projeto: "Mobile [#12]" }).projeto.id, 12);
  assert.match(erroDe(interpretar({ projeto: "Mobile [#99]" }), "projeto"), /#99 não encontrado/);
  assert.match(
    erroDe(interpretar({ tarefa: "Inexistente" }), "tarefa"),
    /não encontrada no projeto/,
  );
  assert.match(erroDe(interpretar({ tarefa: "Revisão" }), "tarefa"), /mais de uma tarefa/);
  assert.equal(interpretar({ tarefa: "Revisão [#103]" }).tarefa.id, 103);
  assert.match(erroDe(interpretar({ tarefa: "Tela [#101]" }), "tarefa"), /não pertence ao projeto/);
  assert.match(erroDe(interpretar({ tarefa: "Arquivada" }), "tarefa"), /inativo/);
  assert.match(erroDe(interpretar({ horas: 0 }), "horas"), /entre 0,01 e 24/);
  assert.match(erroDe(interpretar({ horas: 25 }), "horas"), /entre 0,01 e 24/);
  assert.match(erroDe(interpretar({ horas: 1.234 }), "horas"), /duas casas/);
  assert.match(erroDe(interpretar({ horas: "oito" }), "horas"), /Horas inválidas/);
  assert.equal(interpretar({ horas: "1:20" }).horas, 1.33, "Minutos viram horas com duas casas.");
  assert.match(erroDe(interpretar({ status: "Concluído" }), "status"), /Status inválido/);
  assert.match(erroDe(interpretar({ descricao: "ok" }), "descricao"), /mínimo de 3/);
  assert.deepEqual(
    interpretar({ projeto: "Projeto Antigo" }).erros,
    [],
    "Projeto inativo aceita horas sem tarefa, como no cadastro manual.",
  );
  const vazia = interpretarLinhas([linha({})], cadastros, HOJE)[0];
  assert.deepEqual(
    vazia.erros.map((erro) => erro.campo),
    ["data", "colaborador", "projeto", "horas", "descricao"],
  );
});

test("recusa linhas repetidas, importação repetida e mais de 24 h no dia", () => {
  const linhas = interpretarLinhas(
    [
      { linha: 2, valores: { ...base, horas: 6 } },
      { linha: 3, valores: { ...base, horas: 6 } },
      {
        linha: 4,
        valores: { ...base, colaborador: "bruno@codebi.local", horas: 10, descricao: "Deploy" },
      },
      {
        linha: 5,
        valores: { ...base, colaborador: "bruno@codebi.local", horas: 4, descricao: "Testes" },
      },
      { linha: 6, valores: { ...base, data: "16/10/2026", descricao: "Já gravada" } },
    ],
    cadastros,
    HOJE,
  );
  const existentes = [
    {
      colaboradorId: 2,
      projetoId: 11,
      tarefaId: null,
      data: new Date("2026-10-15"),
      horas: "12.00",
      descricao: "Outro projeto",
    },
    {
      colaboradorId: 1,
      projetoId: 10,
      tarefaId: null,
      data: new Date("2026-10-16"),
      horas: "8.00",
      descricao: "já  GRAVADA",
    },
  ];
  const [l2, l3, l4, l5, l6] = conferirConflitos(linhas, existentes);
  assert.deepEqual(l2.erros, []);
  assert.match(erroDe(l3, "linha"), /igual à linha 2/);
  assert.match(
    erroDe(l4, "horas"),
    /Bruno Costa ficaria com 26 h em 15\/10\/2026: 12 h já lançadas \+ 14 h nesta planilha/,
  );
  assert.equal(erroDe(l5, "horas"), erroDe(l4, "horas"), "Todas as linhas do dia recebem o aviso.");
  assert.match(erroDe(l6, "linha"), /já existe no sistema/);
});

test("avisa, sem bloquear, quando a hora ficaria sem custo completo", () => {
  const linhas = interpretarLinhas(
    [
      { linha: 2, valores: { ...base, data: "10/10/2026" } },
      { linha: 3, valores: { ...base, data: "01/03/2026", descricao: "Antes da equipe" } },
      { linha: 4, valores: { ...base, colaborador: "bruno@codebi.local" } },
    ],
    cadastros,
    HOJE,
  );
  conferirCustos(linhas, {
    equipes: [
      { projetoId: 10, colaboradorId: 1, dataEntrada: new Date("2026-06-01"), dataSaida: null },
      {
        projetoId: 10,
        colaboradorId: 2,
        dataEntrada: new Date("2026-01-01"),
        dataSaida: new Date("2026-12-31"),
      },
    ],
    vigencias: [
      { colaboradorId: 1, dataInicio: new Date("2026-01-01"), dataFim: null },
      { colaboradorId: 2, dataInicio: new Date("2026-01-01"), dataFim: new Date("2026-09-30") },
    ],
  });
  const [l2, l3, l4] = linhas;
  assert.deepEqual(l2.avisos, []);
  assert.match(l3.avisos.join(), /não está na equipe/);
  assert.match(l4.avisos.join(), /não tem valor\/hora vigente/);
  assert.deepEqual(
    [l2, l3, l4].flatMap((item) => item.erros),
    [],
    "Aviso não é erro.",
  );
});

function simularBanco({ existentes = [] } = {}) {
  const original = { ...repositorio };
  const transacaoOriginal = apontamentosRepository.transaction;
  const chamadas = { criar: [], existentes: [] };
  const db = { transacao: true };
  repositorio.cadastros = async () => cadastros;
  repositorio.existentes = async (...args) => {
    chamadas.existentes.push(args);
    return existentes;
  };
  repositorio.criar = async (registros, conexao) => {
    chamadas.criar.push({ registros, conexao });
    return { count: registros.length };
  };
  apontamentosRepository.transaction = async (operacao) => operacao(db);
  return {
    chamadas,
    db,
    restaurar() {
      Object.assign(repositorio, original);
      apontamentosRepository.transaction = transacaoOriginal;
    },
  };
}

test("validar só confere; importar grava tudo numa transação ou nada", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  repositorio.cadastros = async () => ({
    ...cadastros,
    equipes: [
      { projetoId: 10, colaboradorId: 1, dataEntrada: new Date("2026-01-01"), dataSaida: null },
    ],
    vigencias: [{ colaboradorId: 1, dataInicio: new Date("2026-01-01"), dataFim: null }],
  });
  const valida = await planilha([
    [
      "01/10/2026",
      "ana@codebi.local",
      "Portal do Cliente",
      "Tela de login",
      8,
      "Faturado",
      "Login",
    ],
    ["02/10/2026", "bruno@codebi.local", "Mobile [#11]", null, "2,25", null, "Ajustes"],
  ]);
  const previa = await service.validar(valida);
  assert.equal(previa.resumo.validas, 2);
  assert.equal(previa.resumo.comErro, 0);
  assert.equal(previa.resumo.horas, 10.25);
  assert.deepEqual(previa.resumo.periodo, { inicio: "2026-10-01", fim: "2026-10-02" });
  assert.deepEqual(previa.resumo.porStatus, { PENDENTE: 1, APROVADO: 0, FATURADO: 1 });
  assert.equal(previa.resumo.comAviso, 1, "Apenas a linha pendente pode entrar sem parâmetros.");
  assert.equal(previa.linhas[0].avisos.length, 0);
  assert.equal(banco.chamadas.criar.length, 0, "A prévia não grava.");

  const resultado = await service.importar(valida);
  assert.equal(resultado.importados, 2);
  assert.equal(banco.chamadas.criar.length, 1);
  const { registros, conexao } = banco.chamadas.criar[0];
  assert.equal(conexao, banco.db, "Grava dentro da transação.");
  assert.equal(
    banco.chamadas.existentes.at(-1)[2],
    banco.db,
    "Confere o saldo do dia dentro da transação.",
  );
  assert.deepEqual(registros[0], {
    colaboradorId: 1,
    projetoId: 10,
    tarefaId: 100,
    data: new Date("2026-10-01T00:00:00.000Z"),
    horas: 8,
    status: "FATURADO",
    descricao: "Login",
  });
  assert.equal(registros[1].tarefaId, null);
  assert.equal(registros[1].status, "PENDENTE");

  const comErro = await planilha([
    ["01/10/2026", "ana@codebi.local", "Portal do Cliente", null, 8, null, "Certo"],
    ["01/10/2026", "fantasma@codebi.local", "Portal do Cliente", null, 8, null, "Errado"],
  ]);
  await assert.rejects(service.importar(comErro), (error) => {
    assert.equal(error.statusCode, 422);
    assert.match(error.message, /Nenhum apontamento foi importado: 1 linha tem erro/);
    assert.equal(error.details.erros[0].linha, 3);
    assert.equal(error.details.erros[0].coluna, "E-mail do colaborador");
    return true;
  });
  assert.equal(banco.chamadas.criar.length, 1, "Com erro, nada mais é gravado.");
});

test("o modelo traz instruções, listas de cadastros ativos e validações", async () => {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(await montarModelo(cadastros));
  assert.deepEqual(
    pasta.worksheets.map((aba) => aba.name),
    ["Instruções", "Apontamentos", "Listas"],
  );
  const apontamentos = pasta.getWorksheet("Apontamentos");
  assert.deepEqual(
    apontamentos.getRow(1).values.slice(1),
    COLUNAS.map((coluna) => coluna.titulo),
  );
  assert.equal(
    apontamentos.rowCount,
    1,
    "O modelo não traz linhas de exemplo para não serem importadas.",
  );
  const listas = pasta.getWorksheet("Listas");
  const coluna = (numero) =>
    listas
      .getColumn(numero)
      .values.slice(2)
      .filter((valor) => valor !== null && valor !== undefined);
  assert.deepEqual(coluna(1), ["ana@codebi.local", "bruno@codebi.local", "carla1@codebi.local"]);
  assert.deepEqual(
    coluna(4),
    ["Portal do Cliente", "Mobile [#11]", "Mobile [#12]"],
    "Nomes repetidos levam o código.",
  );
  assert.deepEqual(coluna(7), [
    "Tela de login",
    "Tela de login",
    "Revisão [#102]",
    "Revisão [#103]",
  ]);
  // Ao ler o arquivo, o ExcelJS expande cada intervalo célula a célula.
  const validacoes = apontamentos.dataValidations.model;
  for (const linhaFinal of [2, 2001]) {
    assert.equal(validacoes[`A${linhaFinal}`].type, "date");
    assert.equal(validacoes[`B${linhaFinal}`].formulae[0], "Listas!$A$2:$A$4");
    assert.equal(validacoes[`C${linhaFinal}`].formulae[0], "Listas!$D$2:$D$4");
    assert.deepEqual(validacoes[`E${linhaFinal}`].formulae, [0.01, 24]);
    assert.equal(validacoes[`F${linhaFinal}`].formulae[0], '"Pendente,Aprovado,Faturado"');
  }
  assert.equal(validacoes.B2002, undefined);
});

test("o modelo preenchido volta pela importação", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(await montarModelo(cadastros));
  const aba = pasta.getWorksheet("Apontamentos");
  aba.getRow(2).values = [
    new Date(Date.UTC(2026, 9, 5)),
    "carla1@codebi.local",
    "Mobile [#12]",
    null,
    3,
    "Aprovado",
    "Reunião",
  ];
  const resultado = await service.validar(Buffer.from(await pasta.xlsx.writeBuffer()));
  assert.equal(resultado.aba, "Apontamentos");
  assert.deepEqual(resultado.erros, []);
  assert.deepEqual(resultado.linhas[0].projeto, { id: 12, nome: "Mobile" });
});

test("importação faturada sem parâmetros é erro; Pendente continua permitido com aviso", () => {
  const rows = interpretarLinhas(
    [
      { linha: 2, valores: { ...base, status: "Faturado" } },
      { linha: 3, valores: { ...base, status: "Pendente", descricao: "Ainda não faturado" } },
    ],
    cadastros,
    HOJE,
  );
  conferirCustos(rows, {});
  assert.match(erroDe(rows[0], "status"), /necessário valor\/hora/);
  assert.equal(rows[0].erros[0].coluna, "Status");
  assert.deepEqual(rows[1].erros, []);
  assert.equal(rows[1].avisos.length, 2);
});
