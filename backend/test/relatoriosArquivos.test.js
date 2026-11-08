import test from "node:test";
import assert from "node:assert/strict";
import {
  montarExcelRelatorio,
  montarPdfRelatorio,
  nomeArquivo,
  textoPeriodo,
} from "../src/services/relatoriosArquivosService.js";
import { lerPasta, valorDaCelula } from "../src/utils/planilha.js";

function relatorio({ blocos, filtros, dados, projetos } = {}) {
  return {
    id: 7,
    versao: 1,
    autor: "admin",
    criadoEm: "2026-11-07T21:00:00.000Z",
    blocos,
    conteudo: {
      versao: 1,
      filtros: filtros ?? { projetoIds: [1], dataInicio: "2026-10-01", dataFim: "2026-10-31" },
      blocos,
      projetos: projetos ?? [
        { id: 1, nome: "Portal do Cliente", cliente: "Cliente A", status: "ATIVO" },
        { id: 2, nome: "Mobile", cliente: "Cliente A", status: "PAUSADO" },
      ],
      dados,
    },
  };
}

const dados = {
  PROJETOS: {
    linhas: [
      {
        id: 1,
        nome: "Portal do Cliente",
        cliente: "Cliente A",
        status: "ATIVO",
        orcamento: 2424,
        horas: 22,
        custoBase: 1120,
        bonificacao: 92,
        custo: 1212,
        horasSemCusto: 0,
        assertividade: 200,
        inconsistencias: 0,
      },
    ],
  },
  HORAS: {
    total: 22,
    apontamentos: 4,
    horasSemCusto: 0,
    horasSemTarefa: 2,
    porStatus: { APROVADO: 10, FATURADO: 8, PENDENTE: 4 },
    porColaborador: [{ id: 5, nome: "Ana", departamento: null, projetos: 1, horas: 22 }],
  },
  CUSTO: {
    total: 1212,
    custoBase: 1120,
    bonificacao: 92,
    parcial: false,
    horasSemCusto: 0,
    assertividadeMedia: 200,
    projetosComAssertividade: 1,
  },
};

test("o nome do arquivo traz o número, o recorte e a extensão", () => {
  assert.equal(
    nomeArquivo(relatorio({ blocos: ["CUSTO"] }), "pdf"),
    "relatorio-7-portal-do-cliente-2026-10-01-a-2026-10-31.pdf",
  );
  assert.equal(
    nomeArquivo(
      relatorio({ blocos: ["CUSTO"], filtros: { projetoIds: [1, 2], dataInicio: null } }),
      "xlsx",
    ),
    "relatorio-7-2-projetos-todos-os-periodos.xlsx",
  );
  assert.equal(
    nomeArquivo(
      relatorio({ blocos: ["CUSTO"], filtros: { projetoIds: [], dataFim: "2026-10-31" } }),
      "pdf",
    ),
    "relatorio-7-todos-os-projetos-ate-2026-10-31.pdf",
  );
  assert.equal(textoPeriodo({ dataInicio: "2026-10-01" }), "A partir de 01/10/2026");
  // Formato 2: clientes escolhidos aparecem no nome, pelos projetos gravados na fotografia.
  const porCliente = (clienteIds) => ({
    ...relatorio({
      blocos: ["CUSTO"],
      filtros: { projetoIds: [1, 2], clienteIds, dataInicio: null, dataFim: null },
      projetos: [
        { id: 1, nome: "Portal", cliente: "Câmara Ação", clienteId: 9, status: "ATIVO" },
        { id: 2, nome: "Mobile", cliente: "Outro", clienteId: 8, status: "ATIVO" },
      ],
    }),
    versao: 2,
  });
  assert.equal(
    nomeArquivo(porCliente([9]), "pdf"),
    "relatorio-7-cliente-camara-acao-todos-os-periodos.pdf",
  );
  assert.equal(
    nomeArquivo(porCliente([8, 9]), "xlsx"),
    "relatorio-7-2-clientes-todos-os-periodos.xlsx",
  );
});

test("o Excel tem uma aba por bloco escolhido, com os valores da fotografia", async () => {
  const pasta = await lerPasta(
    await montarExcelRelatorio(relatorio({ blocos: ["PROJETOS", "HORAS", "CUSTO"], dados })),
  );
  assert.deepEqual(
    pasta.worksheets.map((aba) => aba.name),
    ["Relatório", "Projetos", "Horas totais", "Horas por colaborador", "Custo total"],
  );
  const resumo = pasta.getWorksheet("Relatório");
  const rotulos = [];
  resumo.eachRow((linha) => rotulos.push(valorDaCelula(linha.getCell(1).value)));
  assert.ok(rotulos.includes("Projetos selecionados"));
  assert.ok(!rotulos.includes("Clientes escolhidos"), "Sem clientes no formato 1.");
  assert.match(String(valorDaCelula(resumo.getCell("A1").value)), /Relatório nº 7/);
  assert.match(String(valorDaCelula(resumo.getCell("A3").value)), /Uso interno/);
  const projetos = pasta.getWorksheet("Projetos");
  assert.deepEqual(projetos.getRow(1).values.slice(1, 4), ["Projeto", "Cliente", "Status"]);
  assert.equal(projetos.getCell("C2").value, "Ativo");
  assert.equal(projetos.getCell("H2").value, 1212);
  assert.equal(projetos.getCell("J2").value, 2, "Assertividade em fração, formatada como %.");
  const horas = pasta.getWorksheet("Horas totais");
  assert.equal(horas.getCell("A1").value, "Horas totais");
  assert.equal(horas.getCell("B1").value, 22);
  const status = [6, 7, 8].map((linha) => [
    horas.getCell(`A${linha}`).value,
    horas.getCell(`B${linha}`).value,
  ]);
  assert.deepEqual(status, [
    ["Pendente", 4],
    ["Aprovado", 10],
    ["Faturado", 8],
  ]);
  assert.equal(pasta.getWorksheet("Horas por colaborador").getCell("B2").value, "Sem departamento");
  const custo = pasta.getWorksheet("Custo total");
  assert.equal(custo.getCell("B1").value, 1212);
  assert.equal(custo.getCell("B4").value, 2);
});

test("o PDF pagina tabelas longas e numera as páginas", async () => {
  const pequeno = await montarPdfRelatorio(relatorio({ blocos: ["CUSTO"], dados }), {
    compress: false,
  });
  const paginas = (pdf) => pdf.toString("latin1").match(/\/Type \/Page\b/g).length;
  assert.equal(pequeno.subarray(0, 5).toString(), "%PDF-");
  assert.equal(paginas(pequeno), 1);
  assert.match(pequeno.toString("latin1"), /\/Title/);
  const ocorrencias = Array.from({ length: 120 }, (_, indice) => ({
    tipo: "SEM_TAREFA",
    projetoId: 1,
    projeto: "Portal do Cliente",
    colaborador: `Pessoa ${indice}`,
    tarefa: null,
    data: "2026-10-02",
    descricao: "Apontamento sem tarefa; classificação de correção desconhecida.",
  }));
  const grande = await montarPdfRelatorio(
    relatorio({
      blocos: ["INCONSISTENCIAS"],
      dados: {
        INCONSISTENCIAS: { total: 120, porTipo: { SEM_TAREFA: 120 }, ocorrencias },
      },
    }),
    { compress: false },
  );
  assert.ok(paginas(grande) >= 3, "120 linhas não cabem numa página.");
});

test("formato que o sistema não conhece não é exportado com números trocados", async () => {
  const antigo = { ...relatorio({ blocos: ["CUSTO"], dados }), versao: 3 };
  await assert.rejects(montarPdfRelatorio(antigo), { statusCode: 409 });
  await assert.rejects(montarExcelRelatorio(antigo), { statusCode: 409 });
});
