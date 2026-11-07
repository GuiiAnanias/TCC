import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount } from "../scripts/testing/dom.mjs";
import { SearchableSelect } from "../src/components/SearchableSelect.jsx";

test("os componentes reais podem ser montados com seus efeitos e desmontados", async () => {
  const cleanup = installDom();
  const view = await mount(
    React.createElement(SearchableSelect, {
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
