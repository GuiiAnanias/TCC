import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, click, change } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { CrudPage } from "../src/pages/CrudPage.jsx";
import { ProjectTeamManager } from "../src/components/ProjectTeamManager.jsx";
import { CollaboratorFinanceManager } from "../src/components/CollaboratorFinanceManager.jsx";

const submit = (form) =>
  act(async () =>
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
  );
test("seletor de cliente obrigatório informa o campo, recebe foco e não envia a API vazio", async () => {
  const cleanup = installDom(),
    originalGet = api.get,
    originalPost = api.post;
  let writes = 0;
  api.get = async (url) => ({
    data: url === "/clientes" ? [{ id: 2, nome: "Cliente disponível", status: "ATIVO" }] : [],
  });
  api.post = async () => {
    writes++;
    return { data: {} };
  };
  const config = {
    key: "teste",
    endpoint: "/registros",
    title: "Registros",
    singular: "registro",
    loadClientes: true,
    fields: [{ name: "clienteId", label: "Cliente", type: "cliente", required: true }],
    columns: [],
  };
  const view = await mount(React.createElement(CrudPage, { config }));
  try {
    await submit(view.container.querySelector("form"));
    assert.equal(writes, 0);
    const button = view.container.querySelector("#clienteId");
    assert.equal(button.getAttribute("aria-invalid"), "true");
    assert.equal(document.activeElement, button);
    assert.match(
      document.getElementById(button.getAttribute("aria-describedby")).textContent,
      /Selecione cliente/,
    );
    await click(button);
    await click(view.container.querySelector('[role="option"]'));
    assert.equal(button.getAttribute("aria-invalid"), "false");
    await submit(view.container.querySelector("form"));
    assert.equal(writes, 1);
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.post = originalPost;
    cleanup();
  }
});

test("equipe valida colaborador e papel antes de enviar, inclusive sem validação HTML", async () => {
  const cleanup = installDom(),
    originalGet = api.get,
    originalPost = api.post;
  let writes = 0;
  api.get = async (url) => ({
    data: url.endsWith("/papeis")
      ? ["Dev"]
      : url === "/colaboradores"
        ? [{ id: 2, nomeCompleto: "Pessoa disponível" }]
        : [],
  });
  api.post = async () => {
    writes++;
    return { data: {} };
  };
  const view = await mount(
    React.createElement(ProjectTeamManager, { project: { id: 1, nome: "Projeto" } }),
  );
  try {
    await submit(view.container.querySelector("form"));
    assert.equal(writes, 0);
    assert.equal(
      view.container.querySelector("#team-colaboradorId").getAttribute("aria-invalid"),
      "true",
    );
    assert.equal(view.container.querySelector("#team-papel").getAttribute("aria-invalid"), "true");
    await change(view.container.querySelector("#team-colaboradorId"), "2");
    await change(view.container.querySelector("#team-papel"), "Dev");
    assert.equal(view.container.querySelector("#team-papel-error"), null);
    await submit(view.container.querySelector("form"));
    assert.equal(writes, 1);
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.post = originalPost;
    cleanup();
  }
});

test("financeiro exige uma faixa disponível e mostra erro acessível antes de enviar", async () => {
  const cleanup = installDom(),
    originalGet = api.get,
    originalPost = api.post;
  let writes = 0;
  api.get = async (url) => ({
    data: url === "/remuneracoes" ? [{ id: 2, nivel: "Pleno I", valorHora: 100 }] : [],
  });
  api.post = async () => {
    writes++;
    return { data: {} };
  };
  const view = await mount(
    React.createElement(CollaboratorFinanceManager, {
      collaborator: { id: 1, nomeCompleto: "Pessoa" },
    }),
  );
  try {
    await submit(view.container.querySelector("form"));
    assert.equal(writes, 0);
    const select = view.container.querySelector("#finance-rate");
    assert.equal(select.getAttribute("aria-invalid"), "true");
    assert.equal(document.activeElement, select);
    await change(select, "2");
    await submit(view.container.querySelector("form"));
    assert.equal(writes, 1);
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.post = originalPost;
    cleanup();
  }
});

test("troca de papel exige papel e data antes de enviar a atualização do vínculo", async () => {
  const cleanup = installDom(),
    originalGet = api.get,
    originalPut = api.put;
  let writes = 0;
  api.get = async (url) => ({
    data: url.endsWith("/papeis")
      ? ["Dev", "QA"]
      : url === "/colaboradores"
        ? []
        : [
            {
              id: 1,
              colaboradorId: 2,
              colaborador: { nomeCompleto: "Pessoa" },
              papel: "Dev",
              dataEntrada: "2026-01-01",
              dataSaida: null,
            },
          ],
  });
  api.put = async () => {
    writes++;
    return { data: {} };
  };
  const view = await mount(
    React.createElement(ProjectTeamManager, { project: { id: 1, nome: "Projeto" } }),
  );
  try {
    await change(view.container.querySelector("#team-role-1"), "");
    await click(view.container.querySelector('[title="Salvar vínculo"]'));
    assert.equal(writes, 0);
    assert.equal(view.container.querySelector("#team-role-1").getAttribute("aria-invalid"), "true");
    await change(view.container.querySelector("#team-role-1"), "QA");
    await change(view.container.querySelector("#team-role-date"), "");
    await click(view.container.querySelector('[title="Salvar vínculo"]'));
    assert.equal(writes, 0);
    assert.equal(document.activeElement.id, "team-role-date");
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.put = originalPut;
    cleanup();
  }
});
