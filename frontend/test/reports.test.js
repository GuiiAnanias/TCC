import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { installDom, mount, click, change } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { RelatoriosPage, textoPeriodo, validarFormulario } from "../src/pages/RelatoriosPage.jsx";

const esperar = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const botao = (raiz, texto) =>
  [...raiz.querySelectorAll("button")].find((item) => item.textContent.trim() === texto);
const opcao = (raiz, texto) =>
  [...raiz.querySelectorAll('[role="option"]')].find((item) => item.textContent.includes(texto));
const caixa = (raiz, rotulo) =>
  [...raiz.querySelectorAll(".report-block")]
    .find((item) => item.textContent.includes(rotulo))
    .querySelector("input");
const linhas = (tabela) =>
  [...tabela.querySelectorAll("tbody tr")].map((linha) =>
    [...linha.querySelectorAll("td")].map((celula) =>
      celula.textContent.replace(/\u00a0/g, " ").trim(),
    ),
  );

const opcoes = {
  projetos: [
    { id: 10, nome: "Portal", clienteId: 1, status: "ATIVO" },
    { id: 11, nome: "Mobile", clienteId: 1, status: "PAUSADO" },
  ],
};
const gerado = {
  id: 7,
  versao: 1,
  autor: "admin",
  criadoEm: "2026-11-07T21:00:00.000Z",
  blocos: ["HORAS", "CUSTO"],
  filtros: { projetoIds: [10], dataInicio: "2026-10-01", dataFim: null },
  conteudo: {
    versao: 1,
    filtros: { projetoIds: [10], dataInicio: "2026-10-01", dataFim: null },
    blocos: ["HORAS", "CUSTO"],
    projetos: [{ id: 10, nome: "Portal", cliente: "Cliente A", status: "ATIVO" }],
    dados: {
      HORAS: {
        total: 12.5,
        apontamentos: 3,
        horasSemCusto: 0,
        horasSemTarefa: 2,
        // Ordem do banco (JSONB), diferente da ordem da tabela.
        porStatus: { APROVADO: 4, FATURADO: 6, PENDENTE: 2.5 },
        porColaborador: [
          { id: 5, nome: "Ana", departamento: "Tecnologia", projetos: 1, horas: 12.5 },
        ],
      },
      CUSTO: {
        total: 900,
        custoBase: 850,
        bonificacao: 50,
        parcial: false,
        horasSemCusto: 0,
        assertividadeMedia: null,
        projetosComAssertividade: 0,
      },
    },
  },
};

function simularApi({ post, get } = {}) {
  const originais = { get: api.get, post: api.post };
  const chamadas = [];
  api.get = async (url, config) => {
    chamadas.push(["GET", url]);
    if (url === "/dashboard/opcoes") return { data: opcoes };
    const resposta = get?.(url, config);
    if (!resposta) throw new Error(`Rota não simulada: ${url}`);
    return resposta;
  };
  api.post = async (url, body, config) => {
    chamadas.push(["POST", url, body]);
    return post(url, body, config);
  };
  return {
    chamadas,
    restaurar: () => Object.assign(api, originais),
  };
}

const rotas = (inicio = "/relatorios") =>
  React.createElement(
    Routes,
    null,
    React.createElement(Route, {
      path: "/",
      element: React.createElement(Navigate, { to: inicio }),
    }),
    React.createElement(Route, {
      path: "/relatorios",
      element: React.createElement(RelatoriosPage),
    }),
    React.createElement(Route, {
      path: "/relatorios/:id",
      element: React.createElement(RelatoriosPage),
    }),
  );

test("o formulário exige um filtro e um bloco, e o período é descrito por extenso", () => {
  const base = { projetoIds: [], dataInicio: "", dataFim: "", blocos: ["CUSTO"] };
  assert.match(validarFormulario(base), /ao menos um filtro/);
  assert.equal(validarFormulario({ ...base, projetoIds: ["10"] }), "");
  assert.equal(validarFormulario({ ...base, dataFim: "2026-10-31" }), "");
  assert.match(validarFormulario({ ...base, projetoIds: ["10"], blocos: [] }), /ao menos um bloco/);
  assert.match(
    validarFormulario({ ...base, dataInicio: "2026-10-31", dataFim: "2026-10-01" }),
    /anterior/,
  );
  assert.equal(
    textoPeriodo({ dataInicio: "2026-10-01", dataFim: "2026-10-31" }),
    "01/10/2026 a 31/10/2026",
  );
  assert.equal(textoPeriodo({ dataInicio: "2026-10-01" }), "A partir de 01/10/2026");
  assert.equal(textoPeriodo({}), "Todos os períodos");
});

test("gerar envia os filtros e mostra só os blocos gravados na fotografia", async () => {
  const cleanup = installDom();
  const api = simularApi({ post: async () => ({ data: gerado }) });
  const view = await mount(rotas());
  try {
    await esperar();
    const raiz = view.container;
    await click(botao(raiz, "Gerar"));
    assert.match(raiz.querySelector('[role="alert"]').textContent, /ao menos um filtro/);
    assert.equal(api.chamadas.filter(([metodo]) => metodo === "POST").length, 0);

    await click(raiz.querySelector("#relatorio-projetos"));
    await click(opcao(raiz, "Portal"));
    await change(raiz.querySelector('input[name="dataInicio"]'), "2026-10-01");
    for (const rotulo of ["Projetos", "Clientes", "Inconsistências"])
      await click(caixa(raiz, rotulo));
    await click(botao(raiz, "Gerar"));
    await esperar();
    const [, url, corpo] = api.chamadas.find(([metodo]) => metodo === "POST");
    assert.equal(url, "/relatorios");
    assert.deepEqual(corpo, {
      projetoIds: [10],
      dataInicio: "2026-10-01",
      dataFim: null,
      blocos: ["HORAS", "CUSTO"],
    });

    const previa = raiz.querySelector(".report-preview");
    assert.match(previa.querySelector("h2").textContent, /Relatório nº 7/);
    assert.match(previa.textContent, /por admin/);
    assert.match(previa.textContent, /A partir de 01\/10\/2026/);
    assert.deepEqual(
      [...previa.querySelectorAll(".report-block-section h3")].map((item) => item.textContent),
      ["Horas totais", "Custo total"],
    );
    const status = previa.querySelectorAll(".report-block-section table")[0];
    assert.deepEqual(linhas(status), [
      ["Pendente", "2,5 h"],
      ["Aprovado", "4 h"],
      ["Faturado", "6 h"],
    ]);
    assert.match(previa.textContent, /Sem projetos com base de cálculo/);
    assert.equal(
      api.chamadas.filter(([metodo, url]) => metodo === "GET" && url === "/relatorios/7").length,
      0,
      "A prévia recém-gerada não consulta de novo.",
    );

    await click(botao(raiz, "Cancelar"));
    assert.equal(raiz.querySelector(".report-preview"), null);
    assert.ok(caixa(raiz, "Projetos").checked, "Cancelar volta ao formulário inicial.");
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});

test("cancelar durante a geração para de esperar e não mostra prévia", async () => {
  const cleanup = installDom();
  const api = simularApi({
    post: (url, body, config) =>
      new Promise((resolve, reject) =>
        config.signal.addEventListener("abort", () => reject(new Error("canceled"))),
      ),
  });
  const view = await mount(rotas());
  try {
    await esperar();
    const raiz = view.container;
    await change(raiz.querySelector('input[name="dataFim"]'), "2026-10-31");
    await click(botao(raiz, "Gerar"));
    assert.equal(botao(raiz, "Gerando…").disabled, true);
    await click(botao(raiz, "Cancelar"));
    await esperar();
    assert.match(raiz.textContent, /Geração cancelada/);
    assert.equal(raiz.querySelector(".report-preview"), null);
    assert.equal(botao(raiz, "Gerar").disabled, false);
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});

test("o endereço com o número abre a fotografia gravada", async () => {
  const cleanup = installDom();
  const api = simularApi({
    get: (url) => {
      if (url === "/relatorios/7") return { data: gerado };
      if (url === "/relatorios/8") {
        const error = new Error("404");
        error.response = { data: { message: "Relatório não encontrado." } };
        throw error;
      }
      return null;
    },
  });
  let view = await mount(rotas("/relatorios/7"));
  try {
    await esperar();
    assert.match(view.container.querySelector(".report-preview h2").textContent, /nº 7/);
    await view.unmount();
    view = await mount(rotas("/relatorios/8"));
    await esperar();
    assert.match(view.container.querySelector('[role="alert"]').textContent, /não encontrado/);
    assert.equal(view.container.querySelector(".report-preview"), null);
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});
