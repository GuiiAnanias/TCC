import test from "node:test";
import assert from "node:assert/strict";
import { relatorioCreateSchema } from "../src/schemas/relatoriosSchemas.js";
import { montarFotografia, VERSAO_RELATORIO } from "../src/services/relatoriosGeradosService.js";

const mensagens = (resultado) => resultado.error.issues.map((issue) => issue.message);

test("o pedido de relatório exige filtro e bloco, e normaliza projetos e blocos", () => {
  assert.deepEqual(mensagens(relatorioCreateSchema.safeParse({ blocos: ["CUSTO"] })), [
    "Informe ao menos um filtro: projetos ou período.",
  ]);
  assert.deepEqual(mensagens(relatorioCreateSchema.safeParse({ projetoIds: [1], blocos: [] })), [
    "Selecione ao menos um bloco.",
  ]);
  const dados = relatorioCreateSchema.parse({
    projetoIds: [12, 3, 12],
    dataInicio: null,
    blocos: ["INCONSISTENCIAS", "PROJETOS", "PROJETOS"],
  });
  assert.deepEqual(dados.projetoIds, [3, 12]);
  assert.deepEqual(dados.blocos, ["PROJETOS", "INCONSISTENCIAS"], "Ordem fixa, sem repetição.");
  assert.ok(relatorioCreateSchema.parse({ dataFim: "2026-10-31", blocos: ["HORAS"] }).dataFim);
  assert.deepEqual(
    mensagens(
      relatorioCreateSchema.safeParse({
        dataInicio: "2026-10-31",
        dataFim: "2026-10-01",
        blocos: ["HORAS"],
      }),
    ),
    ["A data final não pode ser anterior à inicial."],
  );
  assert.equal(
    relatorioCreateSchema.safeParse({ projetoIds: [1], blocos: ["APONTAMENTOS"] }).success,
    false,
  );
  assert.equal(
    relatorioCreateSchema.safeParse({ projetoIds: [1], blocos: ["HORAS"], statusProjeto: "ATIVO" })
      .success,
    false,
    "Campos desconhecidos são recusados.",
  );
  assert.equal(
    relatorioCreateSchema.safeParse({
      projetoIds: Array.from({ length: 51 }, (_, i) => i + 1),
      blocos: ["HORAS"],
    }).success,
    false,
  );
});

const relatorio = {
  resumo: {
    horas: 10,
    horasSemCusto: 2,
    horasSemTarefa: 3,
    custo: 700,
    custoBase: 650,
    bonificacao: 50,
    assertividade: 150,
    projetosComAssertividade: 1,
  },
  projetos: [
    {
      id: 1,
      nome: "Portal",
      cliente: "Cliente A",
      clienteId: 9,
      status: "ATIVO",
      orcamento: 1000,
      horas: 8,
      custoBase: 600,
      bonificacao: 50,
      custo: 650,
      horasSemCusto: 0,
      assertividade: 150,
      inconsistencias: 0,
      vinculosAusentes: [],
    },
    {
      id: 2,
      nome: "Mobile",
      cliente: "Cliente A",
      clienteId: 9,
      status: "PAUSADO",
      orcamento: 0,
      horas: 2,
      custoBase: 50,
      bonificacao: 0,
      custo: 50,
      horasSemCusto: 2,
      assertividade: null,
      inconsistencias: 1,
      vinculosAusentes: [],
    },
  ],
  clientes: [
    {
      id: 9,
      nome: "Cliente A",
      projetos: 2,
      horas: 10,
      custoBase: 650,
      bonificacao: 50,
      custo: 700,
      horasSemCusto: 2,
    },
  ],
  apontamentos: [
    {
      colaboradorId: 5,
      colaborador: "Ana",
      departamento: "Tecnologia",
      projetoId: 1,
      horas: 6,
      status: "FATURADO",
    },
    {
      colaboradorId: 5,
      colaborador: "Ana",
      departamento: "Tecnologia",
      projetoId: 2,
      horas: 2,
      status: "PENDENTE",
    },
    {
      colaboradorId: 6,
      colaborador: "Bruno",
      departamento: null,
      projetoId: 1,
      horas: 2,
      status: "APROVADO",
    },
  ],
  ocorrencias: [
    {
      tipo: "SEM_REMUNERACAO",
      projetoId: 2,
      projeto: "Mobile",
      colaborador: "Ana",
      data: "2026-10-02",
      descricao: "Sem valor/hora preservado vigente na data das horas.",
      apontamentoId: 44,
    },
    {
      tipo: "SEM_ESTIMATIVA",
      projetoId: 1,
      projeto: "Portal",
      tarefaId: 3,
      tarefa: "Login",
      descricao: "Tarefa sem estimativa.",
    },
  ],
};
const filtros = { projetoIds: [1, 2], dataInicio: null, dataFim: null };
const geradoEm = new Date("2026-11-07T21:00:00.000Z");

test("a fotografia guarda só os blocos escolhidos e todos os projetos do recorte", () => {
  const conteudo = montarFotografia(relatorio, { filtros, blocos: ["CUSTO"], geradoEm });
  assert.equal(conteudo.versao, VERSAO_RELATORIO);
  assert.equal(conteudo.geradoEm, "2026-11-07T21:00:00.000Z");
  assert.deepEqual(Object.keys(conteudo.dados), ["CUSTO"]);
  assert.deepEqual(
    conteudo.projetos.map((row) => row.id),
    [1, 2],
    "As referências cobrem o recorte, mesmo sem o bloco de projetos.",
  );
  assert.deepEqual(conteudo.dados.CUSTO, {
    total: 700,
    custoBase: 650,
    bonificacao: 50,
    parcial: true,
    horasSemCusto: 2,
    assertividadeMedia: 150,
    projetosComAssertividade: 1,
  });
});

test("os blocos de horas e inconsistências fecham com os totais do recorte", () => {
  const { dados } = montarFotografia(relatorio, {
    filtros,
    blocos: ["PROJETOS", "CLIENTES", "HORAS", "INCONSISTENCIAS"],
    geradoEm,
  });
  assert.equal(dados.PROJETOS.linhas.length, 2);
  assert.equal("vinculosAusentes" in dados.PROJETOS.linhas[0], false, "Só os campos exibidos.");
  assert.equal(dados.CLIENTES.linhas[0].custo, 700);
  assert.deepEqual(dados.HORAS.porStatus, { PENDENTE: 2, APROVADO: 2, FATURADO: 6 });
  assert.deepEqual(
    dados.HORAS.porColaborador.map((row) => [row.nome, row.projetos, row.horas]),
    [
      ["Ana", 2, 8],
      ["Bruno", 1, 2],
    ],
  );
  assert.equal(
    dados.HORAS.porColaborador.reduce((total, row) => total + row.horas, 0),
    dados.HORAS.total,
  );
  assert.equal(dados.HORAS.apontamentos, 3);
  assert.equal(dados.INCONSISTENCIAS.total, 2);
  assert.equal(dados.INCONSISTENCIAS.porTipo.SEM_REMUNERACAO, 1);
  assert.equal(dados.INCONSISTENCIAS.porTipo.SEM_VINCULO, 0);
  assert.deepEqual(dados.INCONSISTENCIAS.ocorrencias[1], {
    tipo: "SEM_ESTIMATIVA",
    projetoId: 1,
    projeto: "Portal",
    colaborador: null,
    tarefa: "Login",
    data: null,
    descricao: "Tarefa sem estimativa.",
  });
});
