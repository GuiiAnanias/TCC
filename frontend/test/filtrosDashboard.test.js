import test from "node:test";
import assert from "node:assert/strict";
import {
  ajustarRecorte,
  etiquetasDoRecorte,
  mesmoRecorte,
  parametrosDoRecorte,
  periodoRapido,
  projetosDisponiveis,
  sprintsDisponiveis,
} from "../src/utils/filtrosDashboard.js";

const opcoes = {
  clientes: [
    { id: 1, nome: "Cliente A" },
    { id: 2, nome: "Cliente B" },
  ],
  projetos: [
    { id: 10, nome: "Portal", clienteId: 1, status: "ATIVO" },
    { id: 11, nome: "Mobile", clienteId: 1, status: "PAUSADO" },
    { id: 12, nome: "Integração", clienteId: 2, status: "ATIVO" },
  ],
  colaboradores: [{ id: 5, nomeCompleto: "Ana Martins" }],
  sprints: [
    { id: 100, nome: "Sprint 1", projetoId: 10 },
    { id: 101, nome: "Sprint 2", projetoId: 12 },
  ],
};

test("os parâmetros da API juntam os projetos e deixam de fora o que está vazio", () => {
  assert.deepEqual(
    parametrosDoRecorte({
      dataInicio: "",
      clienteId: "1",
      projetoIds: ["10", "12"],
      sprintId: "",
      statusProjeto: "ATIVO",
    }),
    { clienteId: "1", projetoIds: "10,12", statusProjeto: "ATIVO" },
  );
  assert.deepEqual(parametrosDoRecorte({ projetoIds: [], statusProjeto: "" }), {});
});

test("recortes iguais não dependem da ordem em que os projetos foram marcados", () => {
  assert.equal(mesmoRecorte({ projetoIds: ["12", "10"] }, { projetoIds: ["10", "12"] }), true);
  assert.equal(mesmoRecorte({ projetoIds: ["10"] }, { projetoIds: [] }), false);
  assert.equal(mesmoRecorte({ clienteId: "" }, {}), true);
  assert.equal(mesmoRecorte({ statusProjeto: "ATIVO" }, { statusProjeto: "" }), false);
});

test("a lista de projetos segue o cliente e o estado escolhidos", () => {
  const ids = (filtros) => projetosDisponiveis(opcoes.projetos, filtros).map((p) => p.id);
  assert.deepEqual(ids({}), [10, 11, 12]);
  assert.deepEqual(ids({ clienteId: "1" }), [10, 11]);
  assert.deepEqual(ids({ clienteId: "1", statusProjeto: "ATIVO" }), [10]);
});

test("a sprint só aparece com exatamente um projeto escolhido", () => {
  assert.deepEqual(sprintsDisponiveis(opcoes.sprints, []), []);
  assert.deepEqual(sprintsDisponiveis(opcoes.sprints, ["10", "12"]), []);
  assert.deepEqual(
    sprintsDisponiveis(opcoes.sprints, ["12"]).map((s) => s.id),
    [101],
  );
});

test("mudar cliente, estado ou projetos tira do recorte o que deixou de valer", () => {
  const base = { clienteId: "", statusProjeto: "", projetoIds: ["10", "12"], sprintId: "" };
  assert.deepEqual(ajustarRecorte({ ...base, clienteId: "1" }, opcoes).projetoIds, ["10"]);
  assert.deepEqual(ajustarRecorte({ ...base, statusProjeto: "PAUSADO" }, opcoes).projetoIds, []);
  const comSprint = { ...base, projetoIds: ["10"], sprintId: "100" };
  assert.equal(ajustarRecorte(comSprint, opcoes).sprintId, "100");
  assert.equal(
    ajustarRecorte({ ...comSprint, projetoIds: ["10", "12"] }, opcoes).sprintId,
    "",
    "Com dois projetos a sprint sai.",
  );
  assert.deepEqual(
    ajustarRecorte({ ...base, clienteId: "2" }, { projetos: [] }),
    { ...base, clienteId: "2" },
    "Sem as opções carregadas nada é descartado.",
  );
  const semSprint = { projetoIds: ["10", "12"] };
  assert.deepEqual(
    ajustarRecorte(semSprint, opcoes),
    semSprint,
    "Telas sem sprint não ganham campo.",
  );
});

test("as etiquetas mostram o recorte aplicado com nomes, na ordem dos controles", () => {
  const etiquetas = etiquetasDoRecorte(
    {
      dataInicio: "2026-10-01",
      dataFim: "2026-10-31",
      clienteId: "1",
      projetoIds: ["10", "11", "12"],
      colaboradorId: "5",
      sprintId: "100",
      equipe: "Tecnologia",
      statusProjeto: "",
    },
    opcoes,
  );
  assert.deepEqual(
    etiquetas.map((item) => `${item.rotulo}: ${item.valor}`),
    [
      "Período: 01/10/2026 a 31/10/2026",
      "Cliente: Cliente A",
      "Projetos: 3 projetos",
      "Colaborador: Ana Martins",
      "Sprint: Sprint 1",
      "Equipe (departamento): Tecnologia",
      "Status do projeto: Todos os estados",
    ],
  );
  assert.equal(etiquetas[2].completo, "Portal, Mobile, Integração");
  const curto = etiquetasDoRecorte({ dataFim: "2026-10-31", projetoIds: ["10"] }, opcoes);
  assert.deepEqual(
    curto.map((item) => `${item.rotulo}: ${item.valor}`),
    ["Período: Até 31/10/2026", "Projeto: Portal"],
  );
  assert.equal(etiquetasDoRecorte({ projetoIds: ["99"] }, opcoes)[0].valor, "#99");
  assert.equal(etiquetasDoRecorte({ statusProjeto: "ATIVO" })[0].valor, "Ativo");
});

test("os atalhos de período calculam as datas a partir de hoje", () => {
  const hoje = "2026-03-15";
  assert.deepEqual(periodoRapido("mes-atual", hoje), {
    dataInicio: "2026-03-01",
    dataFim: "2026-03-31",
  });
  assert.deepEqual(periodoRapido("ultimos-30", hoje), {
    dataInicio: "2026-02-14",
    dataFim: "2026-03-15",
  });
  assert.deepEqual(periodoRapido("mes-anterior", hoje), {
    dataInicio: "2026-02-01",
    dataFim: "2026-02-28",
  });
  assert.deepEqual(periodoRapido("mes-anterior", "2026-01-10"), {
    dataInicio: "2025-12-01",
    dataFim: "2025-12-31",
  });
  assert.deepEqual(periodoRapido("ano-atual", hoje), {
    dataInicio: "2026-01-01",
    dataFim: "2026-12-31",
  });
});
