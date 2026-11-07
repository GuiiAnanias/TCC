import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { installDom, mount, click, change } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { MultiSelect } from "../src/components/MultiSelect.jsx";
import { DashboardPage } from "../src/pages/DashboardPage.jsx";

const esperar = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const botao = (raiz, texto) =>
  [...raiz.querySelectorAll("button")].find((item) => item.textContent.trim() === texto);
// No navegador, clicar fora (mousedown) fecha a lista aberta.
const clicarFora = () =>
  act(async () =>
    document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })),
  );
const opcao = (raiz, texto) =>
  [...raiz.querySelectorAll('[role="option"]')].find((item) => item.textContent.includes(texto));

test("a seleção múltipla marca, desmarca, busca e limpa mantendo a ordem da lista", async () => {
  const cleanup = installDom();
  const mudancas = [];
  const options = [
    { value: "1", label: "Portal" },
    { value: "2", label: "Mobile" },
    { value: "3", label: "Integração" },
  ];
  function Controle() {
    const [value, setValue] = React.useState([]);
    return React.createElement(MultiSelect, {
      id: "projetos",
      name: "projetoIds",
      options,
      value,
      placeholder: "Todos os projetos",
      plural: "projetos",
      onChange: (event) => {
        mudancas.push(event.target);
        setValue(event.target.value);
      },
    });
  }
  const view = await mount(React.createElement(Controle));
  try {
    const controle = view.container.querySelector("#projetos");
    assert.equal(controle.textContent, "Todos os projetos");
    await click(controle);
    assert.equal(
      view.container.querySelector('[role="listbox"]').getAttribute("aria-multiselectable"),
      "true",
    );
    await click(opcao(view.container, "Integração"));
    await click(opcao(view.container, "Portal"));
    assert.deepEqual(mudancas.at(-1), { name: "projetoIds", value: ["1", "3"] });
    assert.equal(controle.textContent, "2 projetos");
    assert.equal(opcao(view.container, "Portal").getAttribute("aria-selected"), "true");
    await change(view.container.querySelector('input[type="text"]'), "mob");
    assert.equal(view.container.querySelectorAll('[role="option"]').length, 1);
    await change(view.container.querySelector('input[type="text"]'), "");
    await click(opcao(view.container, "Integração"));
    assert.equal(controle.textContent, "Portal", "Com um item, mostra o nome dele.");
    await click(botao(view.container, "Limpar seleção"));
    assert.deepEqual(mudancas.at(-1).value, []);
    assert.equal(controle.textContent, "Todos os projetos");
  } finally {
    await view.unmount();
    cleanup();
  }
});

const opcoesDashboard = {
  clientes: [
    { id: 1, nome: "Cliente A" },
    { id: 2, nome: "Cliente B" },
  ],
  equipes: ["Tecnologia"],
  projetos: [
    { id: 10, nome: "Portal", clienteId: 1, status: "ATIVO" },
    { id: 11, nome: "Mobile", clienteId: 1, status: "PAUSADO" },
    { id: 12, nome: "Integração", clienteId: 2, status: "ATIVO" },
  ],
  colaboradores: [{ id: 5, nomeCompleto: "Ana Martins", status: "ATIVO" }],
  sprints: [
    { id: 100, nome: "Sprint 1", projetoId: 10, statusRegistro: "ATIVO" },
    { id: 101, nome: "Sprint 2", projetoId: 12, statusRegistro: "ATIVO" },
  ],
};
const resumo = {
  projetos: 0,
  projetosAtivos: 0,
  clientes: 0,
  custo: 0,
  custoBase: 0,
  bonificacao: 0,
  horas: 0,
  horasSemCusto: 0,
  registrosSemVinculo: 0,
  assertividade: null,
  projetosComAssertividade: 0,
  totalOcorrencias: 0,
  motivos: {},
};
const dashboardVazio = {
  resumo,
  projetos: [],
  ocorrencias: [],
  tarefas: [],
  auditoria: [],
  clientes: [],
};

test("o dashboard geral filtra por vários projetos, colaborador e sprint, exporta o mesmo recorte e limpa", async () => {
  const cleanup = installDom();
  const original = api.get;
  const chamadas = [];
  api.get = async (url, config = {}) => {
    chamadas.push({ url, params: config.params });
    if (url === "/dashboard/opcoes") return { data: opcoesDashboard };
    if (url === "/relatorios/indicadores.xlsx")
      return { data: new window.Blob(["x"]), headers: {} };
    return { data: dashboardVazio };
  };
  // O download em si é do navegador; aqui basta conferir o pedido feito à API.
  window.HTMLAnchorElement.prototype.click = () => {};
  window.URL.createObjectURL = () => "blob:teste";
  window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  const view = await mount(React.createElement(DashboardPage));
  const ultimo = (url) => chamadas.filter((item) => item.url === url).at(-1).params;
  try {
    await esperar();
    const raiz = view.container;
    assert.deepEqual(ultimo("/dashboard"), { statusProjeto: "ATIVO" }, "Abre com os ativos.");
    const sprint = raiz.querySelector('select[name="sprintId"]');
    assert.equal(sprint.disabled, true, "Sem projeto escolhido, a sprint fica bloqueada.");

    await click(raiz.querySelector("#filtro-projetos"));
    assert.equal(opcao(raiz, "Mobile"), undefined, "Projeto pausado fica fora com o filtro Ativo.");
    await click(opcao(raiz, "Integração"));
    await click(opcao(raiz, "Portal"));
    await clicarFora();
    await change(raiz.querySelector('select[name="colaboradorId"]'), "5");
    assert.equal(sprint.disabled, true, "Com dois projetos, a sprint continua bloqueada.");
    await click(botao(raiz, "Aplicar filtros"));
    await esperar();
    assert.deepEqual(ultimo("/dashboard"), {
      projetoIds: "10,12",
      colaboradorId: "5",
      statusProjeto: "ATIVO",
    });
    const etiquetas = [...raiz.querySelectorAll(".dashboard-tags li")].map((item) =>
      item.textContent.trim(),
    );
    assert.deepEqual(etiquetas, [
      "Projetos: Portal, Integração",
      "Colaborador: Ana Martins",
      "Status do projeto: Ativo",
    ]);

    await click(botao(raiz, "Exportar Excel"));
    await esperar();
    assert.deepEqual(ultimo("/relatorios/indicadores.xlsx"), ultimo("/dashboard"));

    await click(raiz.querySelector("#filtro-projetos"));
    await click(opcao(raiz, "Integração"));
    await clicarFora();
    assert.equal(sprint.disabled, false, "Com um projeto, as sprints dele aparecem.");
    assert.deepEqual(
      [...sprint.options].map((item) => item.textContent),
      ["Todas as sprints", "Sprint 1"],
    );
    await change(sprint, "100");
    await change(raiz.querySelector('select[name="clienteId"]'), "2");
    assert.equal(
      raiz.querySelector("#filtro-projetos").textContent,
      "Todos os projetos",
      "Trocar o cliente tira o projeto de outro cliente.",
    );
    assert.equal(sprint.value, "", "E a sprint dele.");

    await click(botao(raiz, "Limpar"));
    await esperar();
    assert.deepEqual(ultimo("/dashboard"), { statusProjeto: "ATIVO" });
    assert.equal(raiz.querySelector(".dashboard-tags"), null);
    assert.equal(raiz.querySelector('select[name="colaboradorId"]').value, "");
  } finally {
    api.get = original;
    await view.unmount();
    cleanup();
  }
});

test("o dashboard do colaborador usa o mesmo recorte de vários projetos", async () => {
  const cleanup = installDom();
  const original = api.get;
  const chamadas = [];
  api.get = async (url, config = {}) => {
    chamadas.push({ url, params: config.params });
    if (url === "/dashboard/opcoes") return { data: opcoesDashboard };
    return {
      data: {
        ...dashboardVazio,
        tipo: "colaborador",
        colaborador: {
          id: 5,
          nomeCompleto: "Ana Martins",
          cargo: "Dev",
          departamento: "Tecnologia",
          status: "ATIVO",
        },
        apontamentos: [],
        colaboradores: [],
        equipe: [],
      },
    };
  };
  const { EntityDashboardPage } = await import("../src/pages/EntityDashboardPage.jsx");
  // Abre pela rota com o código do colaborador, como no sistema.
  const view = await mount(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/",
        element: React.createElement(Navigate, { to: "/dashboard/colaboradores/5" }),
      }),
      React.createElement(Route, {
        path: "/dashboard/colaboradores/:id",
        element: React.createElement(EntityDashboardPage, { type: "colaboradores" }),
      }),
    ),
  );
  try {
    await esperar();
    const raiz = view.container;
    await click(raiz.querySelector("#entidade-projetos"));
    assert.ok(opcao(raiz, "Mobile · pausado"), "Aqui o histórico de qualquer estado aparece.");
    await click(opcao(raiz, "Mobile"));
    await click(opcao(raiz, "Portal"));
    await clicarFora();
    await click(botao(raiz, "Aplicar filtros"));
    await esperar();
    const pedido = chamadas
      .filter((item) => item.url.startsWith("/dashboard/colaboradores"))
      .at(-1);
    assert.deepEqual(pedido.params, { projetoIds: "10,11" });
    assert.deepEqual(
      [...raiz.querySelectorAll(".dashboard-tags li")].map((item) => item.textContent.trim()),
      ["Projetos: Portal, Mobile"],
    );
  } finally {
    api.get = original;
    await view.unmount();
    cleanup();
  }
});
