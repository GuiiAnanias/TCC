import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, change, click } from "../scripts/testes/dom.mjs";
import { controlRequests } from "../scripts/testes/requisicoes.mjs";
import { api } from "../src/api/conexao.js";
import { CadastroPage } from "../src/pages/CadastroPage.jsx";
const config = {
  key: "registros",
  endpoint: "/registros",
  title: "Registros",
  singular: "registro",
  fields: [],
  columns: [{ key: "nome", label: "Nome" }],
};

test("cadastro envia a equipe inicial e resposta antiga preserva a seleção do formulário atual", async () => {
  const cleanup = installDom(),
    originalGet = api.get,
    originalPost = api.post;
  const pending = Promise.withResolvers();
  let payload;
  api.get = async (url) => ({
    data:
      url === "/projetos/papeis"
        ? ["Dev"]
        : url === "/colaboradores"
          ? [
              { id: 1, nomeCompleto: "Pessoa A" },
              { id: 2, nomeCompleto: "Pessoa B" },
            ]
          : [],
  });
  api.post = async (_url, data) => {
    payload = data;
    return pending.promise;
  };
  const projectConfig = { ...config, key: "projetos", endpoint: "/projetos", teamManager: true };
  const view = await mount(React.createElement(CadastroPage, { config: projectConfig }));
  try {
    await click(view.container.querySelector(".initial-team-choices input"));
    await change(view.container.querySelector(".initial-team-member select"), "Dev");
    await change(
      view.container.querySelector('.initial-team-member input[type="date"]'),
      "2026-11-01",
    );
    await act(async () =>
      view.container
        .querySelector("form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
    );
    assert.deepEqual(payload.equipeInicial, [
      { colaboradorId: 1, papel: "Dev", dataEntrada: "2026-11-01" },
    ]);
    await view.render(React.createElement(CadastroPage, { config: { ...projectConfig } }));
    assert.equal(view.container.querySelectorAll(".initial-team-member").length, 0);
    await click(view.container.querySelectorAll(".initial-team-choices input")[1]);
    await act(async () => pending.resolve({ data: { id: 10 } }));
    assert.match(view.container.querySelector(".initial-team-member").textContent, /Pessoa B/);
    assert.doesNotMatch(view.container.textContent, /cadastrado com sucesso/);
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.post = originalPost;
    cleanup();
  }
});

test("a busca atual prevalece quando respostas antigas chegam depois", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const view = await mount(React.createElement(CadastroPage, { config }));
  try {
    const search = view.container.querySelector('[placeholder="Buscar"]');
    await change(search, "a");
    await change(search, "atual");
    assert.equal(network.requests.length, 3);
    await network.resolve(network.requests[2], [{ id: 3, nome: "Resultado atual" }]);
    await network.resolve(network.requests[1], [{ id: 2, nome: "Resultado antigo" }]);
    await network.reject(network.requests[0]);
    assert.match(view.container.querySelector("tbody").textContent, /Resultado atual/);
    assert.doesNotMatch(
      view.container.textContent,
      /Resultado antigo|Falha antiga|carregar os dados/,
    );
  } finally {
    await view.unmount();
    network.restore();
    cleanup();
  }
});

test("resposta antiga não encerra o carregamento atual nem atravessa a troca de módulo", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const view = await mount(React.createElement(CadastroPage, { config }));
  try {
    await view.render(
      React.createElement(CadastroPage, {
        config: { ...config, key: "outros", endpoint: "/outros", title: "Outros" },
      }),
    );
    await network.resolve(network.requests[0], [{ id: 1, nome: "Módulo anterior" }]);
    assert.equal(view.container.querySelector('[title="Atualizar"]').disabled, true);
    assert.doesNotMatch(view.container.textContent, /Módulo anterior/);
    await network.resolve(network.requests.at(-1), [{ id: 2, nome: "Módulo atual" }]);
    assert.match(view.container.querySelector("tbody").textContent, /Módulo atual/);
  } finally {
    await view.unmount();
    network.restore();
    cleanup();
  }
});

test("opções e erros antigos são descartados ao trocar de módulo e desmontar", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const first = {
    ...config,
    loadClientes: true,
    fields: [{ name: "clienteId", type: "cliente", label: "Cliente" }],
  };
  const view = await mount(React.createElement(CadastroPage, { config: first }));
  let closed = false;
  try {
    const oldOptions = network.requests.find((request) => request.url === "/clientes");
    await view.render(
      React.createElement(CadastroPage, {
        config: { ...first, key: "outros", endpoint: "/outros" },
      }),
    );
    const newOptions = network.requests.filter((request) => request.url === "/clientes").at(-1);
    await network.resolve(newOptions, [{ id: 2, nome: "Cliente atual", status: "ATIVO" }]);
    await network.reject(oldOptions);
    assert.equal(oldOptions.options.signal.aborted, true);
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    assert.equal(view.container.querySelector("#clienteId").disabled, false);
    const pending = network.requests.find((request) => request.url === "/outros");
    await view.unmount();
    closed = true;
    assert.equal(pending.options.signal.aborted, true);
    await network.reject(pending);
  } finally {
    if (!closed) await view.unmount();
    network.restore();
    cleanup();
  }
});

test("registros inativos exibem botão Ativar e reativam via PUT com status ATIVO", async () => {
  const cleanup = installDom(),
    originalGet = api.get,
    originalPut = api.put,
    originalDelete = api.delete;
  let putCall = null;
  let deleteCall = null;
  let rows = [
    { id: 1, nome: "Cliente Inativo", status: "INATIVO" },
    { id: 2, nome: "Cliente Ativo", status: "ATIVO" },
  ];
  api.get = async () => ({ data: rows });
  api.put = async (url, data) => {
    putCall = { url, data };
    rows = rows.map((row) => (row.id === 1 ? { ...row, status: "ATIVO" } : row));
    return { data: { id: 1, status: "ATIVO" } };
  };
  api.delete = async (url) => {
    deleteCall = url;
    return { data: {} };
  };
  const clientConfig = {
    ...config,
    key: "clientes",
    endpoint: "/clientes",
    title: "Clientes",
    singular: "Cliente",
  };
  const view = await mount(React.createElement(CadastroPage, { config: clientConfig }));
  try {
    const activateButton = view.container.querySelector('button[title="Ativar"]');
    const inactivateButton = view.container.querySelector('button[title="Inativar"]');
    assert.ok(activateButton, "Registro inativo deve exibir botão Ativar");
    assert.ok(inactivateButton, "Registro ativo deve exibir botão Inativar");

    await click(activateButton);
    const confirmDialogButton = [...document.querySelectorAll(".confirm-dialog button")].find(
      (btn) => btn.textContent.trim() === "Ativar",
    );
    assert.ok(confirmDialogButton, "Modal de confirmação deve exibir botão Ativar");
    await click(confirmDialogButton);

    assert.deepEqual(putCall, { url: "/clientes/1", data: { status: "ATIVO" } });
    assert.equal(deleteCall, null);
    assert.match(view.container.textContent, /Cliente ativado com sucesso\./);
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.put = originalPut;
    api.delete = originalDelete;
    cleanup();
  }
});
