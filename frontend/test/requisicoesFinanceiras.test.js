import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, click } from "../scripts/testes/dom.mjs";
import { controlRequests } from "../scripts/testes/requisicoes.mjs";
import { api } from "../src/api/conexao.js";
import { FinanceiroColaborador } from "../src/components/financeiro/FinanceiroColaborador.jsx";

const entry = (name) => ({
  id: 1,
  itemTabelaId: 1,
  nivelAplicado: name,
  valorHoraAplicado: 100,
  beneficios: 0,
  dataInicio: "2026-01-01",
  dataFim: null,
});

test("encerrar uma vigência anterior não publica sucesso nem recarrega a pessoa nova", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const originalDelete = api.delete,
    pending = Promise.withResolvers();
  api.delete = () => pending.promise;
  window.confirm = () => true;
  let changes = 0;
  const view = await mount(
    React.createElement(FinanceiroColaborador, {
      collaborator: { id: 1, nomeCompleto: "Pessoa A" },
      onChanged: () => changes++,
    }),
  );
  try {
    await resolveGroup(network, [...network.requests], "Faixa A");
    await click(view.container.querySelector('[title="Encerrar vigência"]'));
    const count = network.requests.length;
    await view.render(
      React.createElement(FinanceiroColaborador, {
        collaborator: { id: 2, nomeCompleto: "Pessoa B" },
        onChanged: () => changes++,
      }),
    );
    await resolveGroup(network, network.requests.slice(count), "Faixa B");
    await act(async () => pending.resolve({ data: {} }));
    assert.equal(changes, 0);
    assert.equal(network.requests.length, count + 2);
    assert.doesNotMatch(view.container.textContent, /Vigência encerrada/);
    assert.match(view.container.querySelector("tbody").textContent, /Faixa B/);
  } finally {
    await view.unmount();
    api.delete = originalDelete;
    network.restore();
    cleanup();
  }
});

test("falha no financeiro é explícita e pode ser recuperada sem trocar de colaborador", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const view = await mount(
    React.createElement(FinanceiroColaborador, {
      collaborator: { id: 1, nomeCompleto: "Pessoa A" },
    }),
  );
  try {
    await network.reject(network.requests[0]);
    await network.resolve(network.requests[1], []);
    assert.match(
      view.container.querySelector('[role="alert"]').textContent,
      /carregar as configurações/,
    );
    assert.equal(view.container.querySelector('[name="itemTabelaId"]').disabled, true);
    await click(view.container.querySelector('[role="alert"] button'));
    await resolveGroup(network, network.requests.slice(2), "Faixa disponível");
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    assert.equal(view.container.querySelector('[name="itemTabelaId"]').disabled, false);
  } finally {
    await view.unmount();
    network.restore();
    cleanup();
  }
});
async function resolveGroup(network, group, name) {
  for (const request of group)
    await network.resolve(
      request,
      request.url === "/remuneracoes" ? [{ id: 1, nivel: name, valorHora: 100 }] : [entry(name)],
    );
}

test("o financeiro antigo não substitui o histórico e o formulário do colaborador atual", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const view = await mount(
    React.createElement(FinanceiroColaborador, {
      collaborator: { id: 1, nomeCompleto: "Pessoa A" },
    }),
  );
  try {
    const old = [...network.requests];
    await view.render(
      React.createElement(FinanceiroColaborador, {
        collaborator: { id: 2, nomeCompleto: "Pessoa B" },
      }),
    );
    await resolveGroup(network, network.requests.slice(old.length), "Faixa atual");
    await resolveGroup(network, old, "Faixa antiga");
    assert.match(view.container.querySelector("tbody").textContent, /Faixa atual/);
    assert.doesNotMatch(view.container.textContent, /Faixa antiga/);
    assert.match(view.container.querySelector('[name="itemTabelaId"]').textContent, /Faixa atual/);
  } finally {
    await view.unmount();
    network.restore();
    cleanup();
  }
});
