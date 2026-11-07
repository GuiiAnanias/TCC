import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { installDom, mount, click, change } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { DashboardPage } from "../src/pages/DashboardPage.jsx";
import { EntityDashboardPage } from "../src/pages/EntityDashboardPage.jsx";

const esperar = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const botao = (raiz, texto) =>
  [...raiz.querySelectorAll("button")].find((item) => item.textContent.trim() === texto);
const linhas = (tabela) =>
  [...tabela.querySelectorAll("tbody tr")].map((linha) =>
    // O Intl separa "R$" do valor com espaço sem quebra.
    [...linha.querySelectorAll("td")].map((celula) =>
      celula.textContent.replace(/\u00a0/g, " ").trim(),
    ),
  );
const opcoes = {
  clientes: [{ id: 1, nome: "Cliente A" }],
  equipes: ["Tecnologia"],
  projetos: [
    { id: 10, nome: "Portal", clienteId: 1, status: "ATIVO" },
    { id: 11, nome: "Mobile", clienteId: 1, status: "PAUSADO" },
  ],
  colaboradores: [{ id: 5, nomeCompleto: "Ana Martins", status: "ATIVO" }],
  sprints: [],
};
const resumo = {
  projetos: 2,
  projetosAtivos: 1,
  clientes: 1,
  custo: 900,
  custoBase: 850,
  bonificacao: 50,
  horas: 10,
  horasSemCusto: 0,
  registrosSemVinculo: 0,
  assertividade: null,
  projetosComAssertividade: 0,
  totalOcorrencias: 3,
  motivos: {},
};

function simularApi(respostas) {
  const original = api.get;
  const chamadas = [];
  api.get = async (url) => {
    chamadas.push(url);
    if (url === "/dashboard/opcoes") return { data: opcoes };
    const resposta = respostas(url);
    if (!resposta) throw new Error(`Rota não simulada: ${url}`);
    return { data: resposta };
  };
  return { chamadas, restaurar: () => (api.get = original) };
}

test("o dashboard geral mostra o ranking de inconsistências e o resumo por equipe", async () => {
  const cleanup = installDom();
  const porTipo = (valores) => ({
    SEM_REMUNERACAO: 0,
    SEM_VINCULO: 0,
    SEM_TAREFA: 0,
    SEM_ESTIMATIVA: 0,
    CONCLUIDA_SEM_HORAS: 0,
    ...valores,
  });
  const api = simularApi(() => ({
    resumo,
    projetos: [],
    ocorrencias: [],
    tarefas: [],
    auditoria: [],
    clientes: [],
    rankingInconsistencias: [
      { id: 11, nome: "Mobile", total: 3, porTipo: porTipo({ SEM_VINCULO: 2, SEM_TAREFA: 1 }) },
      { id: 10, nome: "Portal", total: 0, porTipo: porTipo({}) },
    ],
    equipes: [
      {
        equipe: "Tecnologia",
        colaboradores: 2,
        projetos: 2,
        horas: 8,
        custoBase: 700,
        bonificacao: 50,
        custo: 750,
        horasSemCusto: 0,
        pendencias: 1,
      },
      {
        equipe: "Sem departamento",
        colaboradores: 1,
        projetos: 1,
        horas: 2,
        custoBase: 150,
        bonificacao: 0,
        custo: 150,
        horasSemCusto: 0,
        pendencias: 2,
      },
    ],
  }));
  const view = await mount(React.createElement(DashboardPage));
  try {
    await esperar();
    const raiz = view.container;
    await click(botao(raiz, "Ranking de inconsistências"));
    const ranking = raiz.querySelector("#dashboard-inconsistencias table");
    assert.deepEqual(linhas(ranking), [
      ["1º", "Mobile", "3", "0", "2", "1", "0", "0"],
      ["—", "Portal", "0", "0", "0", "0", "0", "0"],
    ]);
    assert.equal(
      ranking.querySelector("a").getAttribute("href"),
      "/dashboard/projetos/11",
      "Cada projeto leva ao seu dashboard.",
    );
    await click(botao(raiz, "Resumo por equipe"));
    const equipes = raiz.querySelector("#dashboard-equipes table");
    assert.match(equipes.querySelector("caption").textContent, /departamento/);
    assert.deepEqual(
      linhas(equipes).map((linha) => [linha[0], linha[3], linha[7]]),
      [
        ["Tecnologia", "8 h", "1"],
        ["Sem departamento", "2 h", "2"],
      ],
    );
    assert.ok(botao(raiz, "Auditoria operacional"), "O ranking de assertividade continua à parte.");
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});

test("pelo menu, o dashboard individual começa pela escolha e abre o escolhido", async () => {
  const cleanup = installDom();
  const api = simularApi(() => null);
  const view = await mount(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/",
        element: React.createElement(EntityDashboardPage, { type: "projetos" }),
      }),
      React.createElement(Route, {
        path: "/dashboard/projetos/:id",
        element: React.createElement("p", null, "Dashboard aberto"),
      }),
    ),
  );
  try {
    await esperar();
    const raiz = view.container;
    assert.equal(raiz.querySelector("h1").textContent, "Escolha um projeto");
    assert.deepEqual(api.chamadas, ["/dashboard/opcoes"], "Sem projeto, nada além das opções.");
    const seletor = raiz.querySelector(".entity-picker select");
    assert.deepEqual(
      [...seletor.options].map((item) => item.textContent),
      ["Selecione um projeto", "Portal (Ativo)", "Mobile (Pausado)"],
    );
    await change(seletor, "11");
    assert.equal(raiz.textContent, "Dashboard aberto");
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});

test("o dashboard do projeto abre na evolução mensal, com a tabela dos números do gráfico", async () => {
  const cleanup = installDom();
  let evolucao = [
    {
      mes: "2026-09",
      horas: 5.5,
      custoBase: 500,
      bonificacao: 50,
      custo: 550,
      custoAcumulado: 550,
      percentualOrcamento: 55,
      apontamentos: 2,
    },
    {
      mes: "2026-10",
      horas: 2,
      custoBase: 200,
      bonificacao: 20,
      custo: 220,
      custoAcumulado: 770,
      percentualOrcamento: 77,
      apontamentos: 1,
    },
  ];
  const api = simularApi((url) =>
    url === "/dashboard/projetos/10"
      ? {
          resumo,
          tipo: "projeto",
          projeto: {
            id: 10,
            nome: "Portal",
            status: "ATIVO",
            valorProjeto: "1000",
            horasContratadas: 20,
            dataInicio: "2026-09-01",
            cliente: { nome: "Cliente A" },
            sprints: [],
          },
          projetos: [],
          ocorrencias: [],
          tarefas: [],
          apontamentos: [],
          colaboradores: [],
          equipe: [],
          evolucao,
        }
      : null,
  );
  const rotas = React.createElement(
    Routes,
    null,
    React.createElement(Route, {
      path: "/",
      element: React.createElement(Navigate, { to: "/dashboard/projetos/10" }),
    }),
    React.createElement(Route, {
      path: "/dashboard/projetos/:id",
      element: React.createElement(EntityDashboardPage, { type: "projetos" }),
    }),
  );
  let view = await mount(rotas);
  try {
    await esperar();
    const raiz = view.container;
    assert.equal(botao(raiz, "Evolução").getAttribute("aria-pressed"), "true");
    const tabela = raiz.querySelector(".dashboard-detail table");
    assert.deepEqual(
      linhas(tabela).map((linha) => [linha[0], linha[1], linha[4], linha[5], linha[6]]),
      [
        ["09/2026", "5,5 h", "R$ 550,00", "R$ 550,00", "55%"],
        ["10/2026", "2 h", "R$ 220,00", "R$ 770,00", "77%"],
      ],
    );
    await view.unmount();
    evolucao = [];
    view = await mount(rotas);
    await esperar();
    assert.match(
      view.container.querySelector(".dashboard-detail").textContent,
      /Sem apontamentos no recorte/,
    );
  } finally {
    api.restaurar();
    await view.unmount();
    cleanup();
  }
});
