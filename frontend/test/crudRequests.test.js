import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount, change } from "../scripts/testing/dom.mjs";
import { controlRequests } from "../scripts/testing/requests.mjs";
import { api } from "../src/api/client.js";
import { CrudPage } from "../src/pages/CrudPage.jsx";
const config = {
  key: "registros",
  endpoint: "/registros",
  title: "Registros",
  singular: "registro",
  fields: [],
  columns: [{ key: "nome", label: "Nome" }],
};

test("a busca atual prevalece quando respostas antigas chegam depois", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const view = await mount(React.createElement(CrudPage, { config }));
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
  const view = await mount(React.createElement(CrudPage, { config }));
  try {
    await view.render(
      React.createElement(CrudPage, {
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
  const view = await mount(React.createElement(CrudPage, { config: first }));
  let closed = false;
  try {
    const oldOptions = network.requests.find((request) => request.url === "/clientes");
    await view.render(
      React.createElement(CrudPage, { config: { ...first, key: "outros", endpoint: "/outros" } }),
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
