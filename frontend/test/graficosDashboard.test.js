import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { installDom, mount } from "../scripts/testes/dom.mjs";
import {
  STATUS_TAREFA,
  contar,
  fatias,
  mesCurto,
  mesLongo,
  orcamentoPorProjeto,
  principaisEOutros,
  ranking,
} from "../src/utils/dadosGraficos.js";

test("meses aparecem abreviados no eixo e por extenso na dica", () => {
  assert.equal(mesCurto("2026-10"), "out/26");
  assert.equal(mesCurto("2027-01"), "jan/27");
  assert.equal(mesLongo("2026-10"), "outubro de 2026");
});

test("ranking ordena do maior para o menor, ignora zeros e junta o excedente em Outros", () => {
  const lista = [
    { nome: "B", custo: 50 },
    { nome: "A", custo: 50 },
    { nome: "C", custo: 0 },
    { nome: "D", custo: 300 },
  ];
  assert.deepEqual(ranking(lista, { valor: (row) => row.custo, nome: (row) => row.nome }), [
    { nome: "D", valor: 300 },
    { nome: "A", valor: 50 },
    { nome: "B", valor: 50 },
  ]);
  const muitos = Array.from({ length: 11 }, (_, indice) => ({
    nome: `P${indice}`,
    horas: indice + 1,
  }));
  const resultado = ranking(muitos, {
    valor: (row) => row.horas,
    nome: (row) => row.nome,
    limite: 8,
  });
  assert.equal(resultado.length, 8);
  assert.deepEqual(resultado.at(-1), { nome: "Outros (4)", valor: 10, outros: true });
  assert.equal(
    resultado.reduce((soma, item) => soma + item.valor, 0),
    muitos.reduce((soma, item) => soma + item.horas, 0),
    "Nada se perde ao juntar em Outros.",
  );
});

test("o resto do ranking vira um resumo fora da escala, sem sobrar um item sozinho", () => {
  const itens = Array.from({ length: 10 }, (_, indice) => ({
    nome: `Item ${indice}`,
    valor: 100 - indice,
  }));
  const { principais, outros } = principaisEOutros(itens);
  assert.deepEqual(
    principais.map((item) => item.nome),
    itens.slice(0, 7).map((item) => item.nome),
  );
  assert.deepEqual(outros, { quantidade: 3, valor: 93 + 92 + 91 });
  assert.deepEqual(
    principaisEOutros(itens.slice(0, 8)),
    { principais: itens.slice(0, 8), outros: null },
    "Com um só a mais, ele entra como barra.",
  );
});

test("fatias mantêm a ordem fixa das categorias e calculam o percentual", () => {
  const contagem = contar(
    [{ status: "CONCLUIDA" }, { status: "CONCLUIDA" }, { status: "PLANEJADA" }],
    (tarefa) => tarefa.status,
  );
  const { total, itens } = fatias(STATUS_TAREFA, contagem);
  assert.equal(total, 3);
  assert.deepEqual(
    itens.map((item) => [item.chave, item.valor, item.percentual]),
    [
      ["PLANEJADA", 1, 33.3],
      ["EM_ANDAMENTO", 0, 0],
      ["CONCLUIDA", 2, 66.7],
      ["CANCELADA", 0, 0],
    ],
  );
  assert.deepEqual(fatias(STATUS_TAREFA, () => 0).itens[0].percentual, 0);
});

test("orçamento × custo traz os maiores custos e conta os que ficaram de fora", () => {
  const projetos = [
    { id: 1, nome: "Sem nada", orcamento: 0, custo: 0 },
    { id: 2, nome: "Barato", orcamento: 500, custo: 100 },
    { id: 3, nome: "Caro", orcamento: 1000, custo: 1200 },
    { id: 4, nome: "Só orçamento", orcamento: 800, custo: 0 },
  ];
  assert.deepEqual(orcamentoPorProjeto(projetos), {
    itens: [
      { id: 3, nome: "Caro", orcamento: 1000, custo: 1200 },
      { id: 2, nome: "Barato", orcamento: 500, custo: 100 },
      { id: 4, nome: "Só orçamento", orcamento: 800, custo: 0 },
    ],
    ocultos: 0,
  });
  assert.equal(orcamentoPorProjeto(projetos, 2).ocultos, 1);
});

const dados = {
  projetos: [{ id: 1, nome: "Portal", orcamento: 1000, custo: 800 }],
  clientes: [{ id: 1, nome: "Cliente A", custo: 800 }],
  equipes: [{ equipe: "Desenvolvimento", horas: 10 }],
  tarefas: [{ status: "CONCLUIDA" }, { status: "EM_ANDAMENTO" }],
  ocorrencias: [{ tipo: "SEM_TAREFA" }, { tipo: "SEM_TAREFA" }],
  evolucao: [{ mes: "2026-10", horas: 10, custoBase: 700, bonificacao: 100, custo: 800 }],
  apontamentosPorStatus: [
    { status: "PENDENTE", horas: 4 },
    { status: "APROVADO", horas: 6 },
    { status: "FATURADO", horas: 0 },
  ],
};

test("a seção mostra os sete gráficos com legendas legíveis sem passar o mouse", async () => {
  const cleanup = installDom();
  const { default: GraficosDashboard } =
    await import("../src/components/dashboard/GraficosDashboard.jsx");
  const view = await mount(React.createElement(GraficosDashboard, { data: dados }));
  try {
    const titulos = [...view.container.querySelectorAll(".chart-card h3")].map(
      (h) => h.textContent,
    );
    assert.deepEqual(titulos, [
      "Custo por mês",
      "Horas por status do apontamento",
      "Tarefas por status",
      "Custo por cliente",
      "Horas por equipe",
      "Ocorrências de auditoria por tipo",
      "Orçamento × custo por projeto",
    ]);
    const legendas = [...view.container.querySelectorAll(".chart-legend")].map((lista) =>
      [...lista.querySelectorAll("li")].map((li) => li.textContent),
    );
    assert.deepEqual(legendas[0], ["Pendente4 h 40%", "Aprovado6 h 60%", "Faturado0 h 0%"]);
    assert.match(legendas[1].join(" | "), /Em andamento1 50%.*Concluída1 50%/);
    const resumo = view.container.querySelector('[role="img"]').getAttribute("aria-label");
    assert.match(resumo, /outubro de 2026, R\$\s800,00/);
    assert.equal(view.container.querySelectorAll(".chart-empty").length, 0);
  } finally {
    await view.unmount();
    cleanup();
  }
});

test("sem dados no recorte, cada gráfico avisa em vez de desenhar vazio", async () => {
  const cleanup = installDom();
  const { default: GraficosDashboard } =
    await import("../src/components/dashboard/GraficosDashboard.jsx");
  const vazio = {
    projetos: [],
    clientes: [],
    equipes: [],
    tarefas: [],
    ocorrencias: [],
    evolucao: [],
  };
  const view = await mount(
    React.createElement(GraficosDashboard, { data: { ...vazio, apontamentosPorStatus: [] } }),
  );
  try {
    assert.equal(view.container.querySelectorAll(".chart-empty").length, 7);
  } finally {
    await view.unmount();
    cleanup();
  }
});

test("com filtro de período, o gráfico de orçamento explica que o custo é só do recorte", async () => {
  const cleanup = installDom();
  const { default: GraficosDashboard } =
    await import("../src/components/dashboard/GraficosDashboard.jsx");
  const view = await mount(
    React.createElement(GraficosDashboard, { data: dados, recortado: true }),
  );
  try {
    assert.match(view.container.textContent, /o custo é só o do recorte/);
  } finally {
    await view.unmount();
    cleanup();
  }
});

test("com muitos meses, o custo por mês mostra só os 12 últimos e avisa", async () => {
  const cleanup = installDom();
  const { default: GraficosDashboard } =
    await import("../src/components/dashboard/GraficosDashboard.jsx");
  const evolucao = Array.from({ length: 30 }, (_, indice) => {
    const data = new Date(Date.UTC(2024, indice, 1));
    return {
      mes: data.toISOString().slice(0, 7),
      horas: 1,
      custoBase: 100,
      bonificacao: 0,
      custo: 100,
    };
  });
  const view = await mount(
    React.createElement(GraficosDashboard, { data: { ...dados, evolucao } }),
  );
  try {
    const resumo = view.container.querySelector('[role="img"]').getAttribute("aria-label");
    assert.equal(resumo.split(";").length, 12);
    assert.match(resumo, /^Custo por mês: julho de 2025/);
    assert.match(view.container.textContent, /Últimos 12 meses com apontamentos/);
  } finally {
    await view.unmount();
    cleanup();
  }
});
