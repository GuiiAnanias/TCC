import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount, click } from "../scripts/testes/dom.mjs";
import { api } from "../src/api/conexao.js";
import {
  HistoricoImportacoes,
  textoProjetos,
  textoQuantidades,
} from "../src/components/importacao/HistoricoImportacoes.jsx";

const concluida = {
  id: 2,
  criadoEm: "2026-11-10T15:30:00.000Z",
  usuario: { id: 1, nome: "admin" },
  arquivo: "Horas de outubro.xlsx",
  status: "CONCLUIDA",
  mensagem: null,
  linhas: 3,
  importados: 3,
  comErro: 0,
  horas: 11.5,
  periodo: { inicio: "2026-10-01", fim: "2026-10-03" },
  projetos: [
    { id: 11, nome: "Aplicativo Mobile" },
    { id: 10, nome: "Portal do Cliente" },
  ],
  erros: [],
};
const falhou = {
  ...concluida,
  id: 1,
  arquivo: "planilha errada.xlsx",
  status: "FALHOU",
  mensagem: "Nenhum apontamento foi importado: 25 linhas têm erro.",
  linhas: 26,
  importados: 0,
  comErro: 25,
  projetos: [{ id: 10, nome: "Portal do Cliente" }],
  erros: [{ linha: 3, coluna: "E-mail do colaborador", mensagem: "Colaborador não encontrado." }],
};

async function abrir(responder, props = {}) {
  const cleanup = installDom();
  const originalGet = api.get;
  const pedidos = [];
  api.get = async (url, options) => {
    pedidos.push({ url, params: options?.params });
    return { data: responder(options?.params) };
  };
  const view = await mount(React.createElement(HistoricoImportacoes, props));
  return {
    view,
    tela: view.container,
    pedidos,
    async fechar() {
      api.get = originalGet;
      await view.unmount();
      cleanup();
    },
  };
}

test("sem importações mostra a mensagem do requisito", async () => {
  const pagina = await abrir(() => ({ pagina: 1, porPagina: 10, total: 0, paginas: 1, itens: [] }));
  try {
    assert.match(pagina.tela.textContent, /Histórico de Importações/);
    assert.match(pagina.tela.textContent, /Nenhuma importação registrada/);
    assert.equal(pagina.tela.querySelector("table"), null);
    assert.deepEqual(pagina.pedidos, [
      { url: "/importacoes/apontamentos/historico", params: { pagina: 1, porPagina: 10 } },
    ]);
  } finally {
    await pagina.fechar();
  }
});

test("lista data, arquivo, projeto e status, com o motivo das falhas", async () => {
  const pagina = await abrir(() => ({
    pagina: 1,
    porPagina: 10,
    total: 2,
    paginas: 1,
    itens: [concluida, falhou],
  }));
  try {
    const cabecalhos = [...pagina.tela.querySelectorAll("th")].map((th) => th.textContent);
    for (const coluna of ["Data", "Arquivo", "Projeto", "Status"])
      assert.ok(cabecalhos.includes(coluna), coluna);
    const linhas = [...pagina.tela.querySelectorAll("tbody tr")];
    assert.equal(linhas.length, 2);
    assert.match(linhas[0].textContent, /10\/11\/2026, 12:30/);
    assert.match(linhas[0].textContent, /por admin/);
    assert.match(linhas[0].textContent, /Horas de outubro\.xlsx/);
    assert.match(linhas[0].textContent, /Aplicativo Mobile, Portal do Cliente/);
    assert.equal(linhas[0].querySelector(".status").textContent, "Concluída");
    assert.match(linhas[0].textContent, /3 apontamentos · 11,5 h/);
    assert.equal(linhas[1].querySelector(".status").textContent, "Falhou");
    assert.match(linhas[1].textContent, /25 linhas têm erro/);
    assert.match(
      linhas[1].querySelector("details").textContent,
      /primeiros 1 de 25.*Linha 3, E-mail do colaborador: Colaborador não encontrado\./s,
    );
  } finally {
    await pagina.fechar();
  }
});

test("muda de página e volta para a primeira quando há nova importação", async () => {
  const pagina = await abrir((params) => ({
    pagina: params.pagina,
    porPagina: 10,
    total: 15,
    paginas: 2,
    itens: [{ ...concluida, id: params.pagina }],
  }));
  try {
    const proxima = [...pagina.tela.querySelectorAll("button")].find((b) =>
      /Próxima/.test(b.textContent),
    );
    await click(proxima);
    assert.equal(pagina.pedidos.at(-1).params.pagina, 2);
    assert.match(pagina.tela.textContent, /Página 2 de 2/);

    await pagina.view.render(React.createElement(HistoricoImportacoes, { versao: 1 }));
    assert.equal(pagina.pedidos.at(-1).params.pagina, 1);
    assert.match(pagina.tela.textContent, /Página 1 de 2/);
  } finally {
    await pagina.fechar();
  }
});

test("textos do resultado cobrem concluída, falha nas linhas e arquivo ilegível", () => {
  assert.equal(textoQuantidades(concluida), "3 apontamentos · 11,5 h");
  assert.equal(textoQuantidades({ ...concluida, importados: 1, horas: 2 }), "1 apontamento · 2 h");
  assert.equal(textoQuantidades(falhou), "25 de 26 linhas com erro");
  assert.equal(textoQuantidades({ ...falhou, linhas: 0, comErro: 0 }), "Planilha não lida");
  assert.equal(textoProjetos([]), "—");
});
