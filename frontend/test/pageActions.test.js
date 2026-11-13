import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount, click } from "../scripts/testing/dom.mjs";
import { PageActions, PageActionsSlot } from "../src/components/PageActions.jsx";
import { ThemeToggle } from "../src/ThemeContext.jsx";

test("o Atualizar vai para a barra superior quando ela existe", async () => {
  const cleanup = installDom();
  const barra = document.createElement("div");
  document.body.append(barra);
  let atualizacoes = 0;
  const atualizar = () => atualizacoes++;
  const view = await mount(
    React.createElement(
      PageActionsSlot.Provider,
      { value: barra },
      React.createElement(PageActions, { onRefresh: atualizar, loading: false }),
    ),
  );
  try {
    assert.equal(view.container.querySelector("[title='Atualizar']"), null);
    await click(barra.querySelector("[title='Atualizar']"));
    assert.equal(atualizacoes, 1);

    await view.render(React.createElement(PageActions, { onRefresh: atualizar, loading: true }));
    const noCabecalho = view.container.querySelector(".page-actions-inline [title='Atualizar']");
    assert.ok(noCabecalho, "Sem barra, o botão fica no cabeçalho da página.");
    assert.equal(noCabecalho.disabled, true);
  } finally {
    await view.unmount();
    barra.remove();
    cleanup();
  }
});

test("o tema troca na hora e fica guardado", async () => {
  const cleanup = installDom();
  document.documentElement.dataset.theme = "light";
  const view = await mount(React.createElement(ThemeToggle));
  try {
    const botao = view.container.querySelector(".theme-toggle");
    assert.equal(botao.getAttribute("aria-label"), "Usar tema escuro");
    await click(botao);
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(localStorage.getItem("code-bi-theme"), "dark");
    assert.equal(botao.getAttribute("aria-label"), "Usar tema claro");
  } finally {
    await view.unmount();
    cleanup();
  }
});
