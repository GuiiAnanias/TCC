import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { installDom, mount, click, change } from "../scripts/testes/dom.mjs";
import { api } from "../src/api/conexao.js";
import {
  RelatoriosHistoricoPage,
  parametrosDoHistorico,
  textoDownloads,
  textoEscolha,
  textoPeriodoHistorico,
} from "../src/pages/RelatoriosHistoricoPage.jsx";

const esperar = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const botao = (raiz, texto) =>
  [...raiz.querySelectorAll("button")].find((item) => item.textContent.trim() === texto);
const linhas = (raiz) =>
  [...raiz.querySelectorAll(".report-history tbody tr")].map((linha) =>
    [...linha.querySelectorAll("td")].map((celula) =>
      celula.textContent.replace(/[\u00a0\u202f]/g, " ").trim(),
    ),
  );

const item = (id, extra = {}) => ({
  id,
  versao: 2,
  criadoEm: "2026-11-08T16:00:00.000Z",
  autor: "admin",
  autorId: 1,
  blocos: ["PROJETOS", "CUSTO"],
  periodo: { dataInicio: "2026-10-01", dataFim: "2026-10-31" },
  clientes: [],
  projetosSelecionados: ["Portal"],
  projetosNoRecorte: 1,
  exportacoes: { PDF: 0, XLSX: 0, ultima: null },
  ...extra,
});

function simularApi(paginas) {
  const original = api.get;
  const pedidos = [];
  api.get = async (url, config = {}) => {
    if (url === "/dashboard/opcoes") {
      return { data: { projetos: [{ id: 10, nome: "Portal" }], clientes: [] } };
    }
    pedidos.push([url, config.params ?? config.responseType]);
    if (url === "/relatorios") return { data: paginas(config.params) };
    if (url === "/relatorios/9/pdf") {
      return {
        data: new window.Blob(["%PDF-"]),
        headers: { "content-disposition": 'attachment; filename="relatorio-9-cliente-a.pdf"' },
      };
    }
    throw new Error(`Rota não simulada: ${url}`);
  };
  return { pedidos, restaurar: () => (api.get = original) };
}

const rotas = () =>
  React.createElement(
    Routes,
    null,
    React.createElement(Route, {
      path: "/",
      element: React.createElement(Navigate, { to: "/relatorios/historico" }),
    }),
    React.createElement(Route, {
      path: "/relatorios/historico",
      element: React.createElement(RelatoriosHistoricoPage),
    }),
  );

test("os textos da linha do histórico resumem período, escolha e downloads", () => {
  assert.equal(
    textoPeriodoHistorico({ dataInicio: "2026-10-01", dataFim: "2026-10-31" }),
    "01/10/2026 a 31/10/2026",
  );
  assert.equal(textoPeriodoHistorico({ dataInicio: null, dataFim: null }), "Todos os períodos");
  assert.equal(
    textoEscolha(item(1, { clientes: ["Cliente A"], projetosSelecionados: [] })),
    "Clientes: Cliente A",
  );
  assert.equal(
    textoEscolha(item(1, { projetosSelecionados: ["A", "B", "C", "D"] })),
    "Projetos: A, B e mais 2",
  );
  assert.equal(textoEscolha(item(1, { projetosSelecionados: [] })), "Todos com dados no período");
  assert.equal(textoDownloads({ PDF: 2, XLSX: 0 }), "PDF (2)");
  assert.equal(textoDownloads({ PDF: 0, XLSX: 0 }), "Nenhum");
});

test("a consulta só envia os filtros preenchidos e 'só os meus' usa a conta logada", () => {
  const vazio = { projetoId: "", geradoDe: "", geradoAte: "", meus: false };
  assert.deepEqual(parametrosDoHistorico(vazio, 1, 3), { pagina: 1, porPagina: 20 });
  assert.deepEqual(
    parametrosDoHistorico({ ...vazio, projetoId: "10", geradoAte: "2026-11-08", meus: true }, 2, 3),
    { pagina: 2, porPagina: 20, projetoId: "10", geradoAte: "2026-11-08", autorId: 3 },
  );
  assert.equal("autorId" in parametrosDoHistorico({ ...vazio, meus: true }, 1, undefined), false);
});

test("o histórico lista, filtra, pagina e baixa os arquivos de cada relatório", async () => {
  const cleanup = installDom();
  window.HTMLAnchorElement.prototype.click = () => {};
  window.URL.createObjectURL = () => "blob:teste";
  window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  let baixados = 0;
  const simulada = simularApi((params) => {
    if (params.projetoId) return { pagina: 1, porPagina: 20, total: 0, paginas: 0, itens: [] };
    const primeira = params.pagina === 1;
    return {
      pagina: params.pagina,
      porPagina: 20,
      total: 21,
      paginas: 2,
      itens: primeira
        ? [
            item(9, {
              clientes: ["Cliente A"],
              projetosSelecionados: [],
              projetosNoRecorte: 3,
              exportacoes: { PDF: 2 + baixados, XLSX: 1, ultima: null },
            }),
          ]
        : [item(1, { autor: null, periodo: { dataInicio: null, dataFim: null } })],
    };
  });
  const view = await mount(rotas());
  try {
    await esperar();
    const raiz = view.container;
    assert.equal(
      raiz.querySelector(".report-tab[aria-current='page']").textContent.trim(),
      "Histórico",
    );
    const [linha] = linhas(raiz);
    assert.match(linha[0], /^Nº 9/);
    assert.match(linha[0], /08\/11\/2026.*13:00 · admin$/, "Hora de Brasília e autor.");
    assert.deepEqual(linha.slice(1, 5), [
      "01/10/2026 a 31/10/2026",
      "Clientes: Cliente A3 projetos no recorte",
      "Projetos, Custo total",
      "PDF (2), Excel (1)",
    ]);
    assert.equal(
      raiz.querySelector(".report-history tbody a").getAttribute("href"),
      "/relatorios/9",
    );
    assert.match(raiz.querySelector(".report-history-pages").textContent, /Página 1 de 2/);

    baixados = 1;
    await click(raiz.querySelector("[aria-label='Baixar PDF do relatório nº 9']"));
    await esperar();
    assert.match(
      raiz.querySelector(".report-download-feedback[role='status']").textContent,
      /Relatório PDF exportado com sucesso: relatorio-9-cliente-a\.pdf/,
    );
    assert.equal(linhas(raiz)[0][4], "PDF (3), Excel (1)", "A contagem é recarregada.");

    await click(botao(raiz, "Próxima"));
    await esperar();
    const [antiga] = linhas(raiz);
    assert.match(antiga[0], /Usuário removido$/);
    assert.equal(antiga[1], "Todos os períodos");
    assert.match(antiga[2], /^Projetos: Portal1 projeto no recorte$/);

    await click(raiz.querySelector("#projetoId"));
    await click(
      [...raiz.querySelectorAll('[role="option"]')].find((item) => item.textContent === "Portal"),
    );
    await change(raiz.querySelector("input[name='geradoDe']"), "2026-11-01");
    await click(botao(raiz, "Filtrar"));
    await esperar();
    assert.equal(
      raiz.querySelector(".dashboard-empty").textContent,
      "Nenhum relatório encontrado com esses filtros.",
    );
    assert.equal(raiz.querySelector(".report-history-pages"), null);

    const consultas = simulada.pedidos.filter(([url]) => url === "/relatorios");
    assert.deepEqual(
      consultas.map(([, params]) => params),
      [
        { pagina: 1, porPagina: 20 },
        { pagina: 1, porPagina: 20 },
        { pagina: 2, porPagina: 20 },
        { pagina: 1, porPagina: 20, projetoId: "10", geradoDe: "2026-11-01" },
      ],
    );
    assert.ok(
      simulada.pedidos.some(([url, tipo]) => url === "/relatorios/9/pdf" && tipo === "blob"),
    );
  } finally {
    simulada.restaurar();
    await view.unmount();
    cleanup();
  }
});
