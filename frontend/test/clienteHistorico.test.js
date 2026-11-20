import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, click, change } from "../scripts/testes/dom.mjs";
import { api } from "../src/api/conexao.js";
import { CadastroPage } from "../src/pages/CadastroPage.jsx";
import { resources } from "../src/config/cadastros.jsx";
const config = resources.find((item) => item.key === "projetos");
const record = {
  id: 1,
  nome: "Projeto encerrado (demo)",
  clienteId: 4,
  cliente: { nome: "Cliente histórico (demo)", status: "INATIVO" },
  tipoContrato: "FECHADO",
  horasContratadas: 10,
  valorProjeto: 100,
  dataInicio: "2026-01-01",
  status: "INATIVO",
};

test("editar mostra o cliente histórico e salva outro campo sem substituir o vínculo", async () => {
  const cleanup = installDom();
  const originalGet = api.get,
    originalPut = api.put;
  let written;
  api.get = async (url) => ({
    data: url === "/projetos" ? [record] : [{ id: 2, nome: "Cliente ativo", status: "ATIVO" }],
  });
  api.put = async (url, body) => {
    written = { url, body };
    return { data: {} };
  };
  const view = await mount(React.createElement(CadastroPage, { config }));
  try {
    await click(view.container.querySelector('[title="Editar"]'));
    assert.match(
      view.container.querySelector("#clienteId").textContent,
      /Cliente histórico \(demo\) \(inativo\)/,
    );
    await click(view.container.querySelector("#clienteId"));
    const options = [...view.container.querySelectorAll('[role="option"]')];
    assert.equal(options.length, 2);
    await change(view.container.querySelector("#nome"), "Nome corrigido");
    await act(async () =>
      view.container
        .querySelector("form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
    );
    assert.equal(written.url, "/projetos/1");
    assert.deepEqual(written.body, { nome: "Nome corrigido" });
  } finally {
    await view.unmount();
    api.get = originalGet;
    api.put = originalPut;
    cleanup();
  }
});

test("falha de opções é visível, bloqueia o seletor e permite tentar novamente", async () => {
  const cleanup = installDom();
  const original = api.get;
  let fail = true;
  api.get = async (url) => {
    if (url === "/clientes" && fail) throw new Error("rede");
    return { data: url === "/projetos" ? [] : [{ id: 2, nome: "Cliente ativo", status: "ATIVO" }] };
  };
  const view = await mount(React.createElement(CadastroPage, { config }));
  try {
    assert.match(
      view.container.querySelector('[role="alert"]').textContent,
      /carregar os clientes/,
    );
    assert.equal(view.container.querySelector("#clienteId").disabled, true);
    fail = false;
    await click(view.container.querySelector('[role="alert"] button'));
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    assert.equal(view.container.querySelector("#clienteId").disabled, false);
  } finally {
    await view.unmount();
    api.get = original;
    cleanup();
  }
});
