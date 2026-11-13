import test from "node:test";
import assert from "node:assert/strict";
import { relatorioCreateSchema } from "../src/schemas/relatoriosSchemas.js";
import { montarFotografia, VERSAO_RELATORIO } from "../src/services/relatoriosGeradosService.js";
import { relatoriosGeradosService } from "../src/services/relatoriosGeradosService.js";
import { relatoriosGeradosRepository } from "../src/repositories/relatoriosGeradosRepository.js";
import { dashboardService } from "../src/services/dashboardService.js";

const mensagens = (resultado) => resultado.error.issues.map((issue) => issue.message);

test("o pedido de relatório exige filtro e bloco, e normaliza projetos e blocos", () => {
  assert.deepEqual(mensagens(relatorioCreateSchema.safeParse({ blocos: ["CUSTO"] })), [
    "Selecione ao menos um filtro para gerar o relatório.",
  ]);
  assert.deepEqual(mensagens(relatorioCreateSchema.safeParse({ projetoIds: [1], blocos: [] })), [
    "Selecione ao menos um bloco de dados para o relatório.",
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
    relatorioCreateSchema.safeParse({ projetoIds: [1], blocos: ["GRAFICOS"] }).success,
    false,
  );
  assert.equal(
    relatorioCreateSchema.safeParse({ projetoIds: [1], blocos: ["HORAS"], cor: "azul" }).success,
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

test("as opções de personalização são validadas e normalizadas", () => {
  const dados = relatorioCreateSchema.parse({
    equipe: "Tecnologia",
    titulo: "  Fechamento de outubro  ",
    observacoes: "   ",
    statusApontamentos: ["FATURADO", "APROVADO"],
    colunasProjetos: ["custo", "cliente"],
    ordenacao: "CUSTO",
    blocos: ["APONTAMENTOS", "EQUIPES", "EVOLUCAO"],
  });
  assert.equal(dados.titulo, "Fechamento de outubro");
  assert.equal(dados.observacoes, null, "Texto vazio não é gravado.");
  assert.deepEqual(dados.statusApontamentos, ["APROVADO", "FATURADO"]);
  assert.deepEqual(dados.colunasProjetos, ["cliente", "custo"]);
  assert.deepEqual(dados.blocos, ["EQUIPES", "EVOLUCAO", "APONTAMENTOS"]);
  assert.equal(
    relatorioCreateSchema.parse({ colaboradorId: 4, blocos: ["HORAS"] }).ordenacao,
    "NOME",
  );
  assert.deepEqual(
    mensagens(
      relatorioCreateSchema.safeParse({
        projetoIds: [1],
        statusApontamentos: [],
        blocos: ["HORAS"],
      }),
    ),
    ["Selecione ao menos um status das horas."],
  );
  assert.deepEqual(
    mensagens(
      relatorioCreateSchema.safeParse({
        projetoIds: [1],
        titulo: "x".repeat(121),
        blocos: ["HORAS"],
      }),
    ),
    ["O título pode ter até 120 caracteres."],
  );
  assert.equal(
    relatorioCreateSchema.safeParse({ projetoIds: [1], ordenacao: "DATA", blocos: ["HORAS"] })
      .success,
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

test("clientes e projetos compõem uma união sem duplicatas, com limite e recorte vazio protegido", async () => {
  const originalRepo = { ...relatoriosGeradosRepository };
  const originalReport = dashboardService.report;
  const consultas = [];
  let gravado;
  relatoriosGeradosRepository.countProjects = async (ids) => (ids.includes(99) ? 0 : ids.length);
  relatoriosGeradosRepository.findClients = async (ids) =>
    ids.map((id) => ({
      id,
      projetos: id === 9 ? [{ id: 1 }, { id: 2 }] : [],
    }));
  relatoriosGeradosRepository.create = async (data) => {
    gravado = data;
    return { ...data, id: 7, createdAt: geradoEm, criadoPor: { nomeUsuario: "admin" } };
  };
  dashboardService.report = async (filtros) => {
    consultas.push(filtros);
    return relatorio;
  };
  const gerar = (dados) =>
    relatoriosGeradosService.gerar(relatorioCreateSchema.parse(dados), { id: 3 }, geradoEm);
  try {
    await gerar({ clienteIds: [9, 9], projetoIds: [1], blocos: ["HORAS", "CUSTO"] });
    assert.deepEqual(consultas[0], { projetoIds: [1, 2] });
    assert.deepEqual(gravado.filtros.clienteIds, [9]);
    assert.deepEqual(gravado.filtros.projetoIds, [1, 2]);
    assert.equal(gravado.conteudo.dados.CUSTO.total, 700);
    assert.equal(gravado.conteudo.dados.HORAS.total, 10);
    assert.equal(gravado.conteudo.projetos[0].clienteId, 9);
    await assert.rejects(gerar({ clienteIds: [8], blocos: ["HORAS"] }), { statusCode: 422 });
    assert.equal(consultas.length, 1, "Cliente sem projeto nunca consulta todos os projetos.");
    await assert.rejects(gerar({ projetoIds: [99], blocos: ["HORAS"] }), { statusCode: 400 });
    relatoriosGeradosRepository.findClients = async () => [];
    await assert.rejects(gerar({ clienteIds: [99], blocos: ["HORAS"] }), { statusCode: 400 });
    relatoriosGeradosRepository.findClients = async () => [
      { id: 9, projetos: Array.from({ length: 51 }, (_, id) => ({ id: id + 1 })) },
    ];
    await assert.rejects(gerar({ clienteIds: [9], blocos: ["HORAS"] }), { statusCode: 400 });
    assert.equal(consultas.length, 1);
  } finally {
    Object.assign(relatoriosGeradosRepository, originalRepo);
    dashboardService.report = originalReport;
  }
});

test("as opções ficam na fotografia: ordenação, colunas, título e os blocos novos", () => {
  const completo = {
    ...relatorio,
    equipes: [
      {
        equipe: "Tecnologia",
        colaboradores: 1,
        projetos: 2,
        horas: 8,
        custoBase: 600,
        bonificacao: 50,
        custo: 650,
        horasSemCusto: 2,
        pendencias: 1,
      },
    ],
    evolucao: [
      { mes: "2026-10", apontamentos: 3, horas: 10, custoBase: 650, bonificacao: 50, custo: 700 },
    ],
    apontamentos: relatorio.apontamentos.map((row, indice) => ({
      ...row,
      id: indice + 1,
      data: "2026-10-0" + (indice + 1),
      projeto: row.projetoId === 1 ? "Portal" : "Mobile",
      tarefa: null,
      custo: 10,
      semCusto: false,
      descricao: "Trabalho",
    })),
    nomesFiltros: { colaborador: "Ana" },
  };
  const conteudo = montarFotografia(completo, {
    filtros: { ...filtros, colaboradorId: 5 },
    blocos: ["PROJETOS", "EQUIPES", "EVOLUCAO", "APONTAMENTOS"],
    geradoEm,
    opcoes: { titulo: "Fechamento", ordenacao: "HORAS", colunasProjetos: ["custo"] },
  });
  assert.deepEqual(conteudo.opcoes, {
    titulo: "Fechamento",
    observacoes: null,
    ordenacao: "HORAS",
    colunasProjetos: ["custo"],
  });
  assert.equal(conteudo.nomesFiltros.colaborador, "Ana");
  assert.deepEqual(
    conteudo.dados.PROJETOS.linhas.map((row) => row.nome),
    ["Portal", "Mobile"],
    "Mais horas primeiro.",
  );
  assert.equal(conteudo.dados.EQUIPES.linhas[0].nome, "Tecnologia");
  assert.equal("pendencias" in conteudo.dados.EQUIPES.linhas[0], false);
  assert.equal(conteudo.dados.EVOLUCAO.linhas[0].custo, 700);
  assert.equal(conteudo.dados.APONTAMENTOS.linhas.length, 3);
  assert.equal(conteudo.dados.APONTAMENTOS.linhas[0].descricao, "Trabalho");
  const porNome = montarFotografia(completo, { filtros, blocos: ["PROJETOS"], geradoEm });
  assert.deepEqual(
    porNome.dados.PROJETOS.linhas.map((row) => row.nome),
    ["Mobile", "Portal"],
  );
});

test("a prévia usa o mesmo cálculo de gerar e não grava nada no histórico", async () => {
  const originalRepo = { ...relatoriosGeradosRepository };
  const originalReport = dashboardService.report;
  const consultas = [];
  let gravacoes = 0;
  relatoriosGeradosRepository.countProjects = async (ids) => ids.length;
  relatoriosGeradosRepository.findClients = async () => [];
  relatoriosGeradosRepository.create = async () => {
    gravacoes++;
    throw new Error("A prévia não pode gravar.");
  };
  dashboardService.report = async (filtros) => {
    consultas.push(filtros);
    return { ...relatorio, nomesFiltros: { colaborador: filtros.colaboradorId ? "Ana" : null } };
  };
  try {
    const previa = await relatoriosGeradosService.previa(
      relatorioCreateSchema.parse({
        projetoIds: [1],
        colaboradorId: 5,
        equipe: "Tecnologia",
        statusApontamentos: ["APROVADO", "FATURADO"],
        titulo: "Só aprovadas",
        blocos: ["CUSTO"],
      }),
      { id: 3, nomeUsuario: "admin" },
      geradoEm,
    );
    assert.equal(gravacoes, 0);
    assert.equal(previa.id, null);
    assert.equal(previa.previa, true);
    assert.equal(previa.autor, "admin");
    assert.equal(previa.conteudo.opcoes.titulo, "Só aprovadas");
    assert.deepEqual(consultas[0], {
      projetoIds: [1],
      equipe: "Tecnologia",
      colaboradorId: 5,
      statusApontamentos: ["APROVADO", "FATURADO"],
    });
    assert.deepEqual(previa.filtros.statusApontamentos, ["APROVADO", "FATURADO"]);
    dashboardService.report = async () => ({ ...relatorio, nomesFiltros: { colaborador: null } });
    await assert.rejects(
      relatoriosGeradosService.previa(
        relatorioCreateSchema.parse({ colaboradorId: 99, blocos: ["CUSTO"] }),
        { id: 3 },
        geradoEm,
      ),
      { statusCode: 400 },
    );
  } finally {
    Object.assign(relatoriosGeradosRepository, originalRepo);
    dashboardService.report = originalReport;
  }
});
