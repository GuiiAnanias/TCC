import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount, click, change } from "../scripts/testes/dom.mjs";
import { SelecaoComBusca } from "../src/components/comum/SelecaoComBusca.jsx";

test("os componentes reais podem ser montados com seus efeitos e desmontados", async () => {
  const cleanup = installDom();
  const view = await mount(
    React.createElement(SelecaoComBusca, {
      id: "cliente",
      value: "4",
      options: [{ value: "4", label: "Cliente histórico" }],
    }),
  );
  try {
    assert.match(view.container.textContent, /Cliente histórico/);
  } finally {
    await view.unmount();
    cleanup();
  }
});

test("SelecaoComBusca limita a lista a 20 resultados e atualiza mantendo os 20 primeiros da busca", async () => {
  const cleanup = installDom();
  const options = Array.from({ length: 35 }, (_, i) => ({
    value: String(i + 1),
    label: `Registro ${i + 1} - ${i >= 10 ? "Grupo A" : "Grupo B"}`,
  }));
  const view = await mount(
    React.createElement(SelecaoComBusca, {
      id: "seletor-limite",
      name: "registro",
      options,
      value: "",
    }),
  );
  try {
    await click(view.container.querySelector("#seletor-limite"));
    let rendered = [...view.container.querySelectorAll('[role="option"]')];
    assert.equal(rendered.length, 20);
    assert.equal(rendered[0].textContent.trim(), "Registro 1 - Grupo B");
    assert.equal(rendered[19].textContent.trim(), "Registro 20 - Grupo A");
    assert.match(view.container.textContent, /Mostrando 20 de 35 resultados/);

    await change(view.container.querySelector('input[type="text"]'), "Grupo A");
    rendered = [...view.container.querySelectorAll('[role="option"]')];
    assert.equal(rendered.length, 20);
    assert.equal(rendered[0].textContent.trim(), "Registro 11 - Grupo A");
    assert.equal(rendered[19].textContent.trim(), "Registro 30 - Grupo A");
    assert.match(view.container.textContent, /Mostrando 20 de 25 resultados/);
  } finally {
    await view.unmount();
    cleanup();
  }
});
