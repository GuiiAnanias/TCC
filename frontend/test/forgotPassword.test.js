import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, change } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { EsqueciSenhaPage } from "../src/pages/EsqueciSenhaPage.jsx";

const submit = (form) =>
  act(async () => {
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });

test("esqueci minha senha orienta, exige e-mail e mostra a mensagem genérica", async () => {
  const cleanup = installDom();
  const originalPost = api.post;
  const pedidos = [];
  api.post = async (url, body) => {
    pedidos.push({ url, body });
    return {
      data: {
        message:
          "Caso o e-mail informado esteja cadastrado, será enviado um link de redefinição de senha.",
      },
    };
  };
  const view = await mount(React.createElement(EsqueciSenhaPage));
  try {
    const tela = view.container;
    assert.match(tela.querySelector('[role="note"]').textContent, /e-mail da sua conta/);
    assert.equal(tela.querySelectorAll('input[type="password"]').length, 0);

    await submit(tela.querySelector("form"));
    assert.match(tela.querySelector('[role="alert"]').textContent, /Informe o e-mail/);
    await change(tela.querySelector("#email-recuperacao"), "ana");
    await submit(tela.querySelector("form"));
    assert.match(tela.querySelector('[role="alert"]').textContent, /e-mail válido/);
    assert.equal(pedidos.length, 0);

    await change(tela.querySelector("#email-recuperacao"), " ana@sistema.local ");
    await submit(tela.querySelector("form"));
    assert.deepEqual(pedidos, [
      { url: "/auth/esqueci-senha", body: { email: "ana@sistema.local" } },
    ]);
    assert.match(tela.querySelector('[role="status"]').textContent, /Caso o e-mail informado/);
    assert.equal(tela.querySelector("form"), null);
    assert.equal(tela.querySelector('a[href="/login"]').textContent, "Voltar para o login");
  } finally {
    api.post = originalPost;
    await view.unmount();
    cleanup();
  }
});

test("erro do servidor fica visível e permite tentar de novo", async () => {
  const cleanup = installDom();
  const originalPost = api.post;
  api.post = async () => {
    const error = new Error("429");
    error.response = { data: { message: "Muitas tentativas. Aguarde alguns minutos." } };
    throw error;
  };
  const view = await mount(React.createElement(EsqueciSenhaPage));
  try {
    await change(view.container.querySelector("#email-recuperacao"), "ana@sistema.local");
    await submit(view.container.querySelector("form"));
    assert.match(view.container.querySelector('[role="alert"]').textContent, /Muitas tentativas/);
    assert.equal(view.container.querySelector("button[type=submit]").disabled, false);
  } finally {
    api.post = originalPost;
    await view.unmount();
    cleanup();
  }
});
