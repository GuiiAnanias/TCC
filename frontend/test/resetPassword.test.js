import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { installDom, mount, click, change } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { RedefinirSenhaPage } from "../src/pages/RedefinirSenhaPage.jsx";

const TOKEN = "t".repeat(43);
const comToken = { initialEntries: [`/redefinir-senha?token=${TOKEN}`] };
const falha = (status) => {
  const error = new Error(String(status));
  if (status) error.response = { status, data: { message: "Link inválido ou expirado." } };
  return error;
};

async function abrir(post, options = comToken) {
  const cleanup = installDom();
  const originalPost = api.post;
  const pedidos = [];
  api.post = async (url, body) => {
    pedidos.push({ url, body });
    return post(url, body);
  };
  const view = await mount(React.createElement(RedefinirSenhaPage), options);
  return {
    tela: view.container,
    pedidos,
    async fechar() {
      api.post = originalPost;
      await view.unmount();
      cleanup();
    },
  };
}

test("link já usado ou expirado é avisado ao abrir, sem mostrar o formulário", async () => {
  const pagina = await abrir(async () => {
    throw falha(400);
  });
  try {
    assert.deepEqual(pagina.pedidos, [
      { url: "/auth/redefinir-senha/validar", body: { token: TOKEN } },
    ]);
    assert.match(pagina.tela.querySelector('[role="alert"]').textContent, /já foi usado/);
    assert.equal(pagina.tela.querySelector("form"), null);
    assert.equal(pagina.tela.querySelector('input[type="password"]'), null);
    assert.ok(pagina.tela.querySelector('a[href="/esqueci-senha"]'));
  } finally {
    await pagina.fechar();
  }
});

test("link válido mostra o formulário de nova senha", async () => {
  const pagina = await abrir(async () => ({ data: null }));
  try {
    assert.equal(pagina.tela.querySelectorAll('input[type="password"]').length, 2);
    assert.equal(pagina.tela.querySelector('[role="alert"]'), null);
  } finally {
    await pagina.fechar();
  }
});

test("sem token na URL avisa sem consultar o servidor", async () => {
  const pagina = await abrir(async () => ({ data: null }), {
    initialEntries: ["/redefinir-senha"],
  });
  try {
    assert.equal(pagina.pedidos.length, 0);
    assert.match(pagina.tela.querySelector('[role="alert"]').textContent, /já foi usado/);
    assert.equal(pagina.tela.querySelector("form"), null);
  } finally {
    await pagina.fechar();
  }
});

test("falha de conexão na verificação permite tentar de novo", async () => {
  let tentativas = 0;
  const pagina = await abrir(async () => {
    tentativas += 1;
    if (tentativas === 1) throw falha();
    return { data: null };
  });
  try {
    assert.match(pagina.tela.querySelector('[role="alert"]').textContent, /verificar o link/);
    assert.equal(pagina.tela.querySelector("form"), null);
    await click(pagina.tela.querySelector("button.primary-button"));
    assert.equal(tentativas, 2);
    assert.ok(pagina.tela.querySelector("form"));
  } finally {
    await pagina.fechar();
  }
});

test("checklist da senha aparece ao clicar no campo e marca as regras ao digitar", async () => {
  const pagina = await abrir(async () => ({ data: null }));
  try {
    const campo = pagina.tela.querySelector("#nova-senha");
    const lista = pagina.tela.querySelector("#regras-senha");
    assert.equal(campo.getAttribute("aria-describedby"), "regras-senha");
    assert.equal(lista.hidden, true, "escondido até clicar no campo");
    assert.notEqual(document.activeElement, campo, "o campo não recebe foco sozinho");

    await act(async () => campo.focus());
    assert.equal(lista.hidden, false);
    const marcados = () => [...lista.querySelectorAll("li.ok")].length;
    assert.equal(marcados(), 0);
    await change(campo, "Senha1");
    assert.equal(marcados(), 2);
    await change(campo, "Senha1!x");
    assert.equal(marcados(), 4);

    await act(async () => campo.blur());
    assert.equal(lista.hidden, true);
  } finally {
    await pagina.fechar();
  }
});

test("senha atualizada mostra a confirmação e volta sozinha ao login", async () => {
  const cleanup = installDom();
  const originalPost = api.post;
  api.post = async () => ({ data: null });
  function LoginFalso() {
    const location = useLocation();
    return React.createElement("p", { id: "aviso-login" }, location.state?.aviso ?? "");
  }
  const view = await mount(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/redefinir-senha",
        element: React.createElement(RedefinirSenhaPage),
      }),
      React.createElement(Route, { path: "/login", element: React.createElement(LoginFalso) }),
    ),
    comToken,
  );
  try {
    const tela = view.container;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    await change(tela.querySelector("#nova-senha"), "Senha@Forte2026");
    await change(tela.querySelector("#confirmar-senha"), "Senha@Forte2026");
    await act(async () =>
      tela.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true })),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    assert.match(
      tela.querySelector('[role="status"]').textContent,
      /^Senha atualizada com sucesso/,
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 3100)));
    assert.equal(
      tela.querySelector("#aviso-login").textContent,
      "Senha atualizada com sucesso. Entre com a nova senha.",
    );
  } finally {
    api.post = originalPost;
    await view.unmount();
    cleanup();
  }
});
