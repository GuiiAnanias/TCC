import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount } from "../scripts/testing/dom.mjs";
import { api } from "../src/api/client.js";
import { PendenciasCusto } from "../src/components/PendenciasCusto.jsx";
import { ProjectTeamManager } from "../src/components/ProjectTeamManager.jsx";
import { linkDaPendencia, pendenciasDeCusto, situacaoNaEquipe } from "../src/utils/pendencias.js";

const semVinculo = {
  tipo: "SEM_VINCULO",
  apontamentoId: 15,
  projetoId: 4,
  projeto: "Projeto com pendências",
  colaboradorId: 7,
  colaborador: "Gustavo Rocha",
  data: "2026-10-10",
  chave: "SEM_VINCULO:4:15",
};
const semValorHora = {
  ...semVinculo,
  tipo: "SEM_REMUNERACAO",
  apontamentoId: 14,
  colaboradorId: 6,
  colaborador: "Felipe Alves",
  data: "2026-10-09",
  chave: "SEM_REMUNERACAO:4:14",
};

test("links das pendências abrem o lugar certo com quem e quando ajustar", () => {
  assert.equal(linkDaPendencia(semVinculo), "/projetos?equipe=4&colaborador=7&data=2026-10-10");
  assert.equal(linkDaPendencia(semValorHora), "/colaboradores?financeiro=6&data=2026-10-09");
});

test("só ocorrências de custo entram no aviso, das mais recentes para as mais antigas", () => {
  const lista = pendenciasDeCusto([
    semValorHora,
    { ...semVinculo, tipo: "SEM_TAREFA" },
    semVinculo,
  ]);
  assert.deepEqual(
    lista.map((row) => [row.colaborador, row.acao]),
    [
      ["Gustavo Rocha", "Ajustar equipe"],
      ["Felipe Alves", "Cadastrar valor/hora"],
    ],
  );
  assert.match(lista[0].problema, /Fora da equipe do projeto em 10\/10\/2026/);
  assert.match(lista[1].problema, /Sem valor\/hora vigente em 09\/10\/2026/);
});

test("situação na equipe distingue quem nunca participou, quem estava fora do período e resolvido", () => {
  const equipe = [
    { colaboradorId: 7, dataEntrada: "2026-10-15T00:00:00.000Z", dataSaida: null },
    { colaboradorId: 8, dataEntrada: "2026-09-01T00:00:00.000Z", dataSaida: "2026-12-31" },
  ];
  assert.equal(situacaoNaEquipe(equipe, 9, "2026-10-10").situacao, "sem-vinculo");
  assert.equal(situacaoNaEquipe(equipe, "7", "2026-10-10").situacao, "fora-do-periodo");
  assert.equal(situacaoNaEquipe(equipe, 7, "2026-10-15").situacao, "coberto");
  assert.equal(situacaoNaEquipe(equipe, 8, "2026-10-10").situacao, "coberto");
});

test("o aviso do dashboard lista quem, onde e quando, com o botão de correção", async () => {
  const cleanup = installDom();
  const view = await mount(
    React.createElement(PendenciasCusto, { ocorrencias: [semVinculo, semValorHora] }),
  );
  try {
    const tela = view.container;
    assert.match(tela.querySelector("h2").textContent, /2 apontamentos com custo incompleto/);
    const itens = [...tela.querySelectorAll("li")];
    assert.equal(itens.length, 2);
    assert.match(itens[0].textContent, /Gustavo Rocha.*Projeto com pendências · 10\/10\/2026/);
    assert.equal(
      itens[0].querySelector("a").getAttribute("href"),
      "/projetos?equipe=4&colaborador=7&data=2026-10-10",
    );
    assert.match(itens[1].querySelector("a").textContent, /Cadastrar valor\/hora/);
    assert.equal(tela.querySelector(".cost-issues-more"), null);
  } finally {
    await view.unmount();
    cleanup();
  }
});

test("sem pendência de custo o aviso não aparece; com muitas, aponta para a auditoria", async () => {
  const cleanup = installDom();
  const vazio = await mount(
    React.createElement(PendenciasCusto, { ocorrencias: [{ ...semVinculo, tipo: "SEM_TAREFA" }] }),
  );
  try {
    assert.equal(vazio.container.querySelector(".cost-issues"), null);
    const muitas = Array.from({ length: 7 }, (_, indice) => ({
      ...semVinculo,
      apontamentoId: indice,
      chave: `SEM_VINCULO:4:${indice}`,
    }));
    await vazio.render(React.createElement(PendenciasCusto, { ocorrencias: muitas }));
    assert.equal(vazio.container.querySelectorAll("li").length, 5);
    assert.match(
      vazio.container.querySelector(".cost-issues-more").textContent,
      /Ver todas as 7 na Auditoria operacional/,
    );
  } finally {
    await vazio.unmount();
    cleanup();
  }
});

async function abrirEquipe(equipe) {
  const cleanup = installDom();
  const originalGet = api.get;
  api.get = async (url) => {
    if (url === "/projetos/4/equipe") return { data: equipe };
    if (url === "/colaboradores")
      return {
        data: [
          { id: 7, nomeCompleto: "Gustavo Rocha", status: "ATIVO" },
          { id: 8, nomeCompleto: "Ana Martins", status: "ATIVO" },
        ],
      };
    if (url === "/projetos/papeis") return { data: ["Dev", "QA"] };
    throw new Error(`GET inesperado: ${url}`);
  };
  const view = await mount(
    React.createElement(ProjectTeamManager, {
      project: { id: 4, nome: "Projeto com pendências", status: "ATIVO" },
      onChanged() {},
      onClose() {},
      pendencia: { colaboradorId: "7", data: "2026-10-10" },
    }),
  );
  await view.render(
    React.createElement(ProjectTeamManager, {
      project: { id: 4, nome: "Projeto com pendências", status: "ATIVO" },
      onChanged() {},
      onClose() {},
      pendencia: { colaboradorId: "7", data: "2026-10-10" },
    }),
  );
  return {
    tela: view.container,
    async fechar() {
      api.get = originalGet;
      await view.unmount();
      cleanup();
    },
  };
}

test("equipe aberta pelo dashboard explica a pendência e já preenche o vínculo", async () => {
  const pagina = await abrirEquipe([]);
  try {
    assert.match(
      pagina.tela.querySelector(".pending-fix").textContent,
      /Gustavo Rocha lançou horas em 10\/10\/2026 neste projeto, mas não faz parte da equipe/,
    );
    assert.equal(pagina.tela.querySelector("#team-colaboradorId").value, "7");
    assert.equal(pagina.tela.querySelector('form input[type="date"]').value, "2026-10-10");
  } finally {
    await pagina.fechar();
  }
});

test("quem participou fora da data tem a linha destacada e a orientação de ajustar a entrada", async () => {
  const pagina = await abrirEquipe([
    {
      id: 30,
      colaboradorId: 7,
      papel: "Dev",
      dataEntrada: "2026-10-15T00:00:00.000Z",
      dataSaida: null,
      colaborador: { nomeCompleto: "Gustavo Rocha", cargo: "Programador" },
    },
  ]);
  try {
    assert.match(
      pagina.tela.querySelector(".pending-fix").textContent,
      /fora do período.*Ajuste a data de entrada para 10\/10\/2026 ou antes/s,
    );
    assert.equal(pagina.tela.querySelectorAll("tr.team-row-pending").length, 1);
    assert.notEqual(pagina.tela.querySelector("#team-colaboradorId").value, "7");
  } finally {
    await pagina.fechar();
  }
});
