import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { installDom, mount, click } from "../scripts/testing/dom.mjs";
import {
  FONT_SIZES,
  FontSizeControl,
  applyFontSize,
  readFontSize,
} from "../src/components/FontSizeControl.jsx";

const tecla = (alvo, key) =>
  act(async () => alvo.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })));
const opcoes = (raiz) => [...raiz.querySelectorAll("[role='menuitemradio']")];

test("o tamanho do texto fica guardado no navegador e vai para o html", () => {
  const cleanup = installDom();
  try {
    assert.equal(readFontSize(), "padrao", "Sem escolha anterior, vale o padrão.");
    assert.equal(applyFontSize("maior"), "maior");
    assert.equal(document.documentElement.dataset.fontSize, "maior");
    assert.equal(localStorage.getItem("code-bi-font-size"), "maior");
    assert.equal(readFontSize(), "maior");
    assert.equal(applyFontSize("enorme"), "padrao", "Valor desconhecido volta ao padrão.");
    assert.equal(document.documentElement.dataset.fontSize, undefined);
    assert.equal(localStorage.getItem("code-bi-font-size"), null);
    localStorage.setItem("code-bi-font-size", "gigante");
    assert.equal(readFontSize(), "padrao");
    assert.deepEqual(
      FONT_SIZES.map((size) => size.percent),
      [100, 112.5, 125],
    );
  } finally {
    cleanup();
  }
});

test("o botão Aa abre os tamanhos, aplica o escolhido e devolve o foco", async () => {
  const cleanup = installDom();
  const view = await mount(React.createElement(FontSizeControl));
  try {
    const raiz = view.container;
    const botao = raiz.querySelector(".font-size-trigger");
    assert.equal(botao.textContent, "Aa");
    assert.equal(botao.getAttribute("aria-label"), "Tamanho do texto: Padrão");
    assert.equal(botao.getAttribute("aria-expanded"), "false");
    assert.equal(raiz.querySelector("[role='menu']"), null);

    await click(botao);
    assert.equal(botao.getAttribute("aria-expanded"), "true");
    assert.deepEqual(
      opcoes(raiz).map((item) => [item.textContent, item.getAttribute("aria-checked")]),
      [
        ["AaPadrão100%", "true"],
        ["AaGrande112,5%", "false"],
        ["AaMuito grande125%", "false"],
      ],
    );
    assert.equal(document.activeElement, opcoes(raiz)[0], "O foco vai para o tamanho atual.");
    await tecla(document.activeElement, "ArrowDown");
    assert.equal(document.activeElement, opcoes(raiz)[1]);
    await tecla(document.activeElement, "ArrowUp");
    await tecla(document.activeElement, "ArrowUp");
    assert.equal(document.activeElement, opcoes(raiz)[2], "As setas dão a volta na lista.");

    await click(opcoes(raiz)[1]);
    assert.equal(document.documentElement.dataset.fontSize, "grande");
    assert.equal(localStorage.getItem("code-bi-font-size"), "grande");
    assert.equal(raiz.querySelector("[role='menu']"), null, "Escolher fecha a lista.");
    assert.equal(document.activeElement, botao);
    assert.equal(botao.getAttribute("aria-label"), "Tamanho do texto: Grande");

    await click(botao);
    await tecla(document.activeElement, "Escape");
    assert.equal(raiz.querySelector("[role='menu']"), null, "Esc fecha sem mudar.");
    assert.equal(document.documentElement.dataset.fontSize, "grande");
    assert.equal(document.activeElement, botao);

    await click(botao);
    await act(async () =>
      document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true })),
    );
    assert.equal(raiz.querySelector("[role='menu']"), null, "Clicar fora fecha a lista.");
  } finally {
    await view.unmount();
    cleanup();
  }
});
