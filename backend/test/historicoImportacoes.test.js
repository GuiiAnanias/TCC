import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  importacaoApontamentosService as service,
  nomeDoArquivo,
  ABA_APONTAMENTOS,
  CABECALHOS_MODELO,
} from "../src/services/importacaoApontamentosService.js";
import { importacaoApontamentosRepository as repositorio } from "../src/repositories/importacaoApontamentosRepository.js";
import { apontamentosRepository } from "../src/repositories/apontamentosRepository.js";

const cadastros = {
  colaboradores: [
    { id: 1, nomeCompleto: "Ana Martins", email: "ana@codebi.local", status: "ATIVO" },
    { id: 2, nomeCompleto: "Bruno Costa", email: "bruno@codebi.local", status: "ATIVO" },
  ],
  projetos: [
    { id: 10, nome: "Portal do Cliente", status: "ATIVO", cliente: { nome: "Cliente A" } },
    { id: 11, nome: "Aplicativo Mobile", status: "ATIVO", cliente: { nome: "Cliente B" } },
  ],
  tarefas: [],
  // Todos na equipe dos dois projetos: novas horas exigem equipe válida na data.
  equipes: [10, 11].flatMap((projetoId) =>
    [1, 2].map((colaboradorId) => ({
      projetoId,
      colaboradorId,
      dataEntrada: new Date("2026-01-01"),
      dataSaida: null,
    })),
  ),
  vigencias: [],
};

async function planilha(linhas) {
  const pasta = new ExcelJS.Workbook();
  const aba = pasta.addWorksheet(ABA_APONTAMENTOS);
  aba.addRow(CABECALHOS_MODELO);
  for (const linha of linhas) aba.addRow(linha);
  return Buffer.from(await pasta.xlsx.writeBuffer());
}

// Banco simulado: guarda o que foi gravado e em qual conexão (dentro ou fora da transação).
function simularBanco() {
  const original = { ...repositorio };
  const transacaoOriginal = apontamentosRepository.transaction;
  const db = { transacao: true };
  const gravado = { apontamentos: [], historico: [] };
  repositorio.cadastros = async () => cadastros;
  repositorio.existentes = async () => [];
  repositorio.criar = async (registros) => {
    gravado.apontamentos.push(...registros);
    return { count: registros.length };
  };
  repositorio.registrar = async (dados, conexao) => {
    gravado.historico.push({ dados, conexao });
    return { id: gravado.historico.length };
  };
  apontamentosRepository.transaction = async (operacao) => operacao(db);
  return {
    db,
    gravado,
    restaurar() {
      Object.assign(repositorio, original);
      apontamentosRepository.transaction = transacaoOriginal;
    },
  };
}

const usuario = { usuarioId: 5, arquivo: encodeURIComponent("Horas de outubro – equipe.xlsx") };
const linhaValida = [
  "01/10/2026",
  "ana@codebi.local",
  "Portal do Cliente",
  null,
  8,
  null,
  "Desenvolvimento",
];

test("importação concluída grava o histórico na mesma transação dos apontamentos", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  const arquivo = await planilha([
    ["02/10/2026", "bruno@codebi.local", "Portal do Cliente", null, "2,5", null, "Ajustes"],
    ["01/10/2026", "ana@codebi.local", "Aplicativo Mobile", null, 8, null, "Login"],
    ["03/10/2026", "ana@codebi.local", "Portal do Cliente", null, 1, null, "Revisão"],
  ]);
  const resposta = await service.importar(arquivo, usuario);
  assert.equal(resposta.importados, 3);
  assert.equal(resposta.historicoId, 1);
  assert.equal(banco.gravado.historico.length, 1);
  const { dados, conexao } = banco.gravado.historico[0];
  assert.equal(conexao, banco.db, "O registro entra na transação dos apontamentos.");
  assert.deepEqual(dados, {
    usuarioId: 5,
    arquivo: "Horas de outubro – equipe.xlsx",
    status: "CONCLUIDA",
    importados: 3,
    linhas: 3,
    comErro: 0,
    horas: 11.5,
    periodoInicio: new Date("2026-10-01T00:00:00.000Z"),
    periodoFim: new Date("2026-10-03T00:00:00.000Z"),
    projetos: [
      { id: 11, nome: "Aplicativo Mobile" },
      { id: 10, nome: "Portal do Cliente" },
    ],
    erros: [],
  });
});

test("importação com erro nas linhas registra a falha depois do rollback", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  const linhas = [linhaValida];
  for (let n = 0; n < 25; n++)
    linhas.push([
      `0${(n % 9) + 1}/10/2026`,
      "fantasma@codebi.local",
      "Portal do Cliente",
      null,
      1,
      null,
      "Erro",
    ]);
  await assert.rejects(service.importar(await planilha(linhas), usuario), { statusCode: 422 });
  assert.equal(banco.gravado.apontamentos.length, 0);
  assert.equal(banco.gravado.historico.length, 1);
  const { dados, conexao } = banco.gravado.historico[0];
  assert.equal(conexao, undefined, "A falha é gravada fora da transação desfeita.");
  assert.equal(dados.status, "FALHOU");
  assert.equal(dados.importados, 0);
  assert.equal(dados.linhas, 26);
  assert.equal(dados.comErro, 25);
  assert.match(dados.mensagem, /Nenhum apontamento foi importado: 25 linhas têm erro/);
  assert.equal(dados.erros.length, 20, "Guarda só as primeiras 20 linhas com erro.");
  assert.deepEqual(Object.keys(dados.erros[0]).sort(), ["coluna", "linha", "mensagem"]);
  assert.equal(dados.erros[0].linha, 3);
  assert.deepEqual(dados.projetos, [{ id: 10, nome: "Portal do Cliente" }]);
});

test("arquivo ilegível e erro inesperado também entram no histórico", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  await assert.rejects(service.importar(Buffer.from("data;horas"), usuario), { statusCode: 400 });
  const ilegivel = banco.gravado.historico[0].dados;
  assert.equal(ilegivel.status, "FALHOU");
  assert.equal(ilegivel.linhas, 0);
  assert.deepEqual(ilegivel.projetos, []);
  assert.match(ilegivel.mensagem, /\.xlsx/);

  repositorio.criar = async () => {
    throw new Error("conexão perdida com detalhes internos");
  };
  await assert.rejects(service.importar(await planilha([linhaValida]), usuario), /conexão perdida/);
  const inesperado = banco.gravado.historico[1].dados;
  assert.equal(inesperado.status, "FALHOU");
  assert.equal(inesperado.mensagem, "Erro inesperado ao importar. Nenhum apontamento foi gravado.");
  assert.doesNotMatch(JSON.stringify(inesperado), /detalhes internos/);
});

test("falha ao gravar o histórico não esconde o erro da importação", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(" "));
  t.after(() => {
    console.error = originalError;
  });
  repositorio.registrar = async () => {
    throw new Error("tabela indisponível");
  };
  await assert.rejects(service.importar(Buffer.from("x"), usuario), { statusCode: 400 });
  assert.match(logs.join("\n"), /tabela indisponível/);
});

test("sem usuário a importação funciona como antes, sem histórico", async (t) => {
  const banco = simularBanco();
  t.after(() => banco.restaurar());
  const resposta = await service.importar(await planilha([linhaValida]));
  assert.equal(resposta.importados, 1);
  assert.equal(resposta.historicoId, undefined);
  assert.equal(banco.gravado.historico.length, 0);
});

test("nome do arquivo vem limpo, sem caminho e com acentos", () => {
  assert.equal(nomeDoArquivo(encodeURIComponent("C:\\fakepath\\Março.xlsx")), "Março.xlsx");
  assert.equal(nomeDoArquivo("pasta%2Fhoras.xlsx"), "horas.xlsx");
  assert.equal(nomeDoArquivo("%E0%A4"), "%E0%A4", "Codificação inválida fica como veio.");
  assert.equal(nomeDoArquivo(undefined), "planilha.xlsx");
  assert.equal(nomeDoArquivo("   "), "planilha.xlsx");
  assert.equal(
    nomeDoArquivo(encodeURIComponent("a" + String.fromCharCode(7) + "b.xlsx")),
    "ab.xlsx",
  );
  assert.equal(nomeDoArquivo("x".repeat(300)).length, 255);
});

test("histórico lista da mais recente para a mais antiga, com páginas", async (t) => {
  const original = repositorio.historico;
  t.after(() => {
    repositorio.historico = original;
  });
  let filtrosRecebidos;
  repositorio.historico = async (filtros) => {
    filtrosRecebidos = filtros;
    return {
      total: 21,
      itens: [
        {
          id: 9,
          createdAt: new Date("2026-11-10T15:00:00.000Z"),
          usuario: { id: 5, nomeUsuario: "admin" },
          arquivo: "horas.xlsx",
          status: "CONCLUIDA",
          mensagem: null,
          linhas: 3,
          importados: 3,
          comErro: 0,
          horas: "11.5",
          periodoInicio: new Date("2026-10-01T00:00:00.000Z"),
          periodoFim: new Date("2026-10-03T00:00:00.000Z"),
          projetos: [{ id: 10, nome: "Portal do Cliente" }],
          erros: [],
        },
      ],
    };
  };
  const resultado = await service.historico({ pagina: 3, porPagina: 10 });
  assert.deepEqual(filtrosRecebidos, { pagina: 3, porPagina: 10 });
  assert.equal(resultado.paginas, 3);
  assert.equal(resultado.total, 21);
  assert.deepEqual(resultado.itens[0], {
    id: 9,
    criadoEm: new Date("2026-11-10T15:00:00.000Z"),
    usuario: { id: 5, nome: "admin" },
    arquivo: "horas.xlsx",
    status: "CONCLUIDA",
    mensagem: null,
    linhas: 3,
    importados: 3,
    comErro: 0,
    horas: 11.5,
    periodo: { inicio: "2026-10-01", fim: "2026-10-03" },
    projetos: [{ id: 10, nome: "Portal do Cliente" }],
    erros: [],
  });
});
