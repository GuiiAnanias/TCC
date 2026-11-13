import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, click } from "../scripts/testes/dom.mjs";
import { controlRequests } from "../scripts/testes/requisicoes.mjs";
import { api } from "../src/api/conexao.js";
import { EquipeProjeto } from "../src/components/projetos/EquipeProjeto.jsx";

const member = (id, name) => ({
  id,
  colaboradorId: id,
  papel: "Dev",
  colaborador: { nomeCompleto: name, cargo: "Dev" },
  dataEntrada: "2026-01-01",
  dataSaida: null,
});

test("uma gravação antiga não recarrega nem publica mensagens no projeto novo", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const originalPut = api.put,
    pending = Promise.withResolvers();
  api.put = () => pending.promise;
  let changes = 0;
  const view = await mount(
    React.createElement(EquipeProjeto, {
      project: { id: 1, nome: "Projeto A", status: "ATIVO" },
      onChanged: () => changes++,
    }),
  );
  try {
    await resolveGroup(network, [...network.requests], "Pessoa A");
    await click(view.container.querySelector('[title="Salvar vínculo"]'));
    const count = network.requests.length;
    await view.render(
      React.createElement(EquipeProjeto, {
        project: { id: 2, nome: "Projeto B", status: "ATIVO" },
        onChanged: () => changes++,
      }),
    );
    const current = network.requests.slice(count);
    await act(async () => pending.resolve({ data: {} }));
    assert.equal(network.requests.length, count + 3);
    assert.equal(changes, 0);
    assert.doesNotMatch(view.container.textContent, /Vínculo atualizado/);
    assert.match(view.container.querySelector("tbody").textContent, /Carregando equipe/);
    await resolveGroup(network, current, "Pessoa B");
  } finally {
    await view.unmount();
    api.put = originalPut;
    network.restore();
    cleanup();
  }
});
async function resolveGroup(network, group, name) {
  for (const request of group)
    await network.resolve(
      request,
      request.url.endsWith("/equipe")
        ? [member(1, name)]
        : request.url.endsWith("/papeis")
          ? ["Dev"]
          : [],
    );
}
test("a equipe da entidade anterior não substitui a atual nem encerra seu carregamento", async () => {
  const cleanup = installDom(),
    network = controlRequests(api);
  const view = await mount(
    React.createElement(EquipeProjeto, {
      project: { id: 1, nome: "Projeto A", status: "ATIVO" },
    }),
  );
  try {
    const old = [...network.requests];
    await view.render(
      React.createElement(EquipeProjeto, {
        project: { id: 2, nome: "Projeto B", status: "ATIVO" },
      }),
    );
    const current = network.requests.slice(old.length);
    await resolveGroup(network, current, "Pessoa atual");
    await resolveGroup(network, old, "Pessoa antiga");
    assert.match(view.container.querySelector("tbody").textContent, /Pessoa atual/);
    assert.doesNotMatch(view.container.textContent, /Pessoa antiga/);
  } finally {
    await view.unmount();
    network.restore();
    cleanup();
  }
});
