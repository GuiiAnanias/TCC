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
  clientes: [
    { id: 1, nome: "Cliente A" },
    { id: 2, nome: "Cliente B" },
  ],
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

test("a busca unificada distingue clientes de projetos e combina as escolhas", async () => {
  const cleanup = installDom();
  const api = simularApi({ post: async () => ({ data: gerado }) });
  const view = await mount(rotas());
  try {
    await esperar();
    const raiz = view.container;
    await click(raiz.querySelector("#relatorio-projetos"));
    const busca = raiz.querySelector('input[aria-label="Buscar seleções"]');
    await change(busca, "Cliente A");
    assert.equal(
      raiz.querySelectorAll('[role="option"]').length,
      3,
      "Busca também encontra o cliente indicado em cada projeto.",
    );
    await click(opcao(raiz, "Cliente: Cliente A"));
    await change(busca, "Portal");
    await click(opcao(raiz, "Projeto: Portal"));
    await click(botao(raiz, "Gerar"));
    await esperar();
    const chamada = api.chamadas.find(([metodo]) => metodo === "POST");
    assert.deepEqual(chamada[2].clienteIds, [1]);
    assert.deepEqual(chamada[2].projetoIds, [10]);
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});

test("personalizar cancela sem gravar, valida seleção, mantém erros no modal e gera outra fotografia", async () => {
  const cleanup = installDom();
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const original = structuredClone(gerado);
  original.conteudo.projetos = [
    { id: 10, nome: "Portal", clienteId: 1, cliente: "Cliente A" },
    { id: 11, nome: "Mobile", clienteId: 1, cliente: "Cliente A" },
    { id: 12, nome: "Site", clienteId: 2, cliente: "Cliente A" },
  ];
  let tentativas = 0;
  const api = simularApi({
    get: () => ({ data: original }),
    post: async () => {
      tentativas++;
      if (tentativas === 1) throw { response: { data: { message: "Conflito. Tente novamente." } } };
      return { data: { ...gerado, id: 8 } };
    },
  });
  const view = await mount(rotas("/relatorios/7"));
  try {
    await esperar();
    const raiz = view.container;
    await click(botao(raiz, "Personalizar relatório"));
    let modal = document.querySelector("dialog.report-customization");
    assert.ok(modal.open);
    await click(botao(modal, "Cancelar"));
    assert.equal(document.querySelector("dialog.report-customization"), null);
    assert.equal(api.chamadas.filter(([m]) => m === "POST").length, 0);
    await click(botao(raiz, "Personalizar relatório"));
    modal = document.querySelector("dialog.report-customization");
    const clientes = modal.querySelectorAll('input[aria-label="Cliente: Cliente A"]');
    assert.equal(clientes.length, 2, "Mesmo nome, IDs diferentes: os clientes são independentes.");
    await click(clientes[0]);
    assert.equal(modal.querySelector('input[aria-label="Projeto: Portal"]').checked, false);
    assert.equal(modal.querySelector('input[aria-label="Projeto: Site"]').checked, true);
    await click(clientes[1]);
    await click(botao(modal, "Gerar nova prévia"));
    assert.match(modal.querySelector('[role="alert"]').textContent, /ao menos um projeto/);
    assert.equal(tentativas, 0);
    await click(modal.querySelector('input[aria-label="Projeto: Portal"]'));
    assert.equal(clientes[0].indeterminate, true);
    await click(botao(modal, "Gerar nova prévia"));
    await esperar();
    assert.match(modal.querySelector('[role="alert"]').textContent, /Conflito/);
    assert.equal(modal.querySelector('input[aria-label="Projeto: Portal"]').checked, true);
    assert.match(raiz.querySelector(".report-preview h2").textContent, /nº 7/);
    await click(botao(modal, "Gerar nova prévia"));
    await esperar();
    assert.equal(document.querySelector("dialog.report-customization"), null);
    assert.match(raiz.querySelector(".report-preview h2").textContent, /nº 8/);
    const corpo = api.chamadas.filter(([m]) => m === "POST")[1][2];
    assert.deepEqual(corpo, {
      projetoIds: [10],
      dataInicio: "2026-10-01",
      dataFim: null,
      blocos: ["HORAS", "CUSTO"],
    });
    assert.equal(original.id, 7, "O original não foi alterado.");
    assert.equal(original.conteudo.projetos.length, 3);
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});

test("os arquivos são baixados da fotografia, com aviso de sucesso ou do erro da API", async () => {
  const cleanup = installDom();
  const pedidos = [];
  const api = simularApi({
    get: (url, config) => {
      if (url === "/relatorios/7") return { data: gerado };
      if (url === "/relatorios/7/pdf") {
        pedidos.push([url, config.responseType]);
        return {
          data: new window.Blob(["%PDF-"]),
          headers: {
            "content-disposition": 'attachment; filename="relatorio-7-portal-desde-2026-10-01.pdf"',
          },
        };
      }
      if (url === "/relatorios/7/xlsx") {
        pedidos.push([url, config.responseType]);
        const error = new Error("409");
        // Com responseType "blob", até o erro chega como Blob (o mesmo Blob global do app).
        error.response = {
          data: new Blob([JSON.stringify({ message: "Formato não suportado." })]),
        };
        throw error;
      }
      return null;
    },
  });
  // O download em si é do navegador; aqui basta conferir o pedido e o aviso.
  window.HTMLAnchorElement.prototype.click = () => {};
  window.URL.createObjectURL = () => "blob:teste";
  window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  const view = await mount(rotas("/relatorios/7"));
  try {
    await esperar();
    const raiz = view.container;
    await click(botao(raiz, "Baixar PDF"));
    await esperar();
    assert.match(
      raiz.querySelector(".report-download-feedback[role='status']").textContent,
      /relatorio-7-portal-desde-2026-10-01\.pdf baixado/,
    );
    await click(botao(raiz, "Baixar Excel"));
    await esperar();
    assert.match(
      raiz.querySelector(".report-download-feedback[role='alert']").textContent,
      /Formato não suportado/,
    );
    assert.deepEqual(pedidos, [
      ["/relatorios/7/pdf", "blob"],
      ["/relatorios/7/xlsx", "blob"],
    ]);
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});
