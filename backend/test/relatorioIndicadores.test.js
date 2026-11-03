import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { dashboardRepository } from "../src/repositories/dashboardRepository.js";
import { bonificacoesPapeisRepository } from "../src/repositories/bonificacoesPapeisRepository.js";
import { dashboardService } from "../src/services/dashboardService.js";
import { relatoriosService } from "../src/services/relatoriosService.js";

const pessoa = (id, nome, valorHora) => ({
  nomeCompleto: nome,
  email: `${nome.split(" ")[0].toLowerCase()}@codebi.local`,
  cargo: "Desenvolvedor",
  departamento: "Desenvolvimento",
  configuracoesFinanceiras: valorHora
    ? [
        {
          id,
          dataInicio: new Date("2026-01-01"),
          dataFim: null,
          valorHoraAplicado: valorHora,
          nivelAplicado: "Pleno I",
        },
      ]
    : [],
});
const apontamento = (id, colaboradorId, colaborador, horas, data, extra = {}) => ({
  id,
  colaboradorId,
  colaborador,
  tarefaId: null,
  horas: String(horas),
  data: new Date(data),
  status: "APROVADO",
  descricao: `Atividade ${id}`,
  ...extra,
});
const ana = pessoa(1, "Ana Martins", "50");
const bruno = pessoa(2, "Bruno Costa", null);
const projetos = [
  {
    id: 10,
    nome: "Portal",
    status: "ATIVO",
    clienteId: 1,
    cliente: { id: 1, nome: "Cliente A" },
    valorProjeto: "1100",
    equipe: [
      { colaboradorId: 1, papel: "Dev", dataEntrada: new Date("2026-01-01"), dataSaida: null },
    ],
    tarefas: [
      {
        id: 5,
        titulo: "Tela de login",
        status: "CONCLUIDA",
        statusRegistro: "ATIVO",
        minutosEstimados: 600,
        apontamentos: [],
      },
    ],
    apontamentos: [
      apontamento(1, 1, ana, 8, "2026-10-01", { tarefaId: 5 }),
      apontamento(2, 1, ana, 12, "2026-10-02"),
    ],
  },
  {
    id: 11,
    nome: "Mobile",
    status: "INATIVO",
    clienteId: 2,
    cliente: { id: 2, nome: "Cliente B" },
    valorProjeto: "500",
    equipe: [],
    tarefas: [],
    apontamentos: [apontamento(3, 2, bruno, 4, "2026-10-03", { status: "FATURADO" })],
  },
];
const bonificacoes = [
  { papel: "Dev", percentual: 10, dataInicio: new Date("2026-01-01"), dataFim: null },
];

function simular({ carregados = projetos } = {}) {
  const original = { ...dashboardRepository };
  const bonificacoesOriginal = bonificacoesPapeisRepository.findAll;
  const filtrosRecebidos = [];
  dashboardRepository.load = async (filtros) => {
    filtrosRecebidos.push(filtros);
    return carregados;
  };
  dashboardRepository.filterNames = async () => ({
    cliente: "Cliente A",
    projeto: null,
    colaborador: null,
    sprint: null,
  });
  bonificacoesPapeisRepository.findAll = async () => bonificacoes;
  return {
    filtrosRecebidos,
    restaurar() {
      Object.assign(dashboardRepository, original);
      bonificacoesPapeisRepository.findAll = bonificacoesOriginal;
    },
  };
}

async function abrir(buffer) {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(buffer);
  return pasta;
}
const linhaDe = (aba, numero) => aba.getRow(numero).values.slice(1);
const procurar = (aba, rotulo) => {
  let encontrada;
  aba.eachRow((linha) => {
    if (linha.getCell(1).value === rotulo) encontrada = linha.getCell(2);
  });
  return encontrada;
};

test("relatório usa o recorte do dashboard e soma igual aos indicadores", async (t) => {
  const banco = simular();
  t.after(() => banco.restaurar());
  const filtros = {
    clienteId: 1,
    dataInicio: new Date("2026-10-01T00:00:00.000Z"),
    dataFim: new Date("2026-10-31T00:00:00.000Z"),
  };
  const { arquivo, nome } = await relatoriosService.indicadoresXlsx(
    filtros,
    new Date("2026-11-02T22:30:00.000Z"),
  );
  assert.equal(nome, "indicadores-codebi-2026-11-02.xlsx");
  assert.deepEqual(banco.filtrosRecebidos, [filtros]);
  const dashboard = await dashboardService.get(filtros);
  const pasta = await abrir(arquivo);
  assert.deepEqual(
    pasta.worksheets.map((aba) => aba.name),
    ["Resumo", "Projetos", "Clientes", "Colaboradores", "Apontamentos", "Ocorrências"],
  );

  const resumo = pasta.getWorksheet("Resumo");
  assert.match(resumo.getCell("A2").value, /Gerado em 02\/11\/2026.*19:30/);
  assert.match(resumo.getCell("A3").value, /Não enviar ao cliente/);
  assert.equal(
    procurar(resumo, "Período (data dos apontamentos)").value,
    "01/10/2026 a 31/10/2026",
  );
  assert.equal(procurar(resumo, "Cliente").value, "Cliente A");
  assert.equal(procurar(resumo, "Equipe (departamento)").value, "Todas");
  assert.equal(procurar(resumo, "Horas trabalhadas").value, dashboard.resumo.horas);
  assert.equal(procurar(resumo, "Custo total (R$)").value, dashboard.resumo.custo);
  assert.equal(procurar(resumo, "Custo total (R$)").numFmt, '"R$" #,##0.00');
  assert.equal(
    procurar(resumo, "Assertividade média do orçamento").value,
    "Indisponível",
    "Com período, como no dashboard.",
  );

  const projetosAba = pasta.getWorksheet("Projetos");
  assert.equal(projetosAba.getTable("Projetos").table.tableRef, "A1:N3");
  const portal = linhaDe(projetosAba, 2);
  assert.deepEqual(portal.slice(0, 8), ["Portal", "Cliente A", "Ativo", 1100, 1100, 1000, 100, 20]);
  assert.equal(linhaDe(projetosAba, 3)[2], "Inativo");

  const apontamentos = pasta.getWorksheet("Apontamentos");
  const primeira = linhaDe(apontamentos, 2);
  assert.equal(primeira[0], 1);
  assert.deepEqual(primeira[1], new Date("2026-10-01T00:00:00.000Z"));
  assert.equal(apontamentos.getCell("B2").numFmt, "dd/mm/yyyy");
  assert.deepEqual(primeira.slice(2, 7), [
    "Cliente A",
    "Portal",
    "Tela de login",
    "Ana Martins",
    "ana@codebi.local",
  ]);
  assert.deepEqual(primeira.slice(9, 17), ["Dev", "Pleno I", 50, 8, 400, 0.1, 40, 440]);
  assert.equal(apontamentos.getCell("O2").numFmt, "0.00%");
  const semCusto = linhaDe(apontamentos, 4);
  assert.deepEqual(semCusto.slice(17), ["Faturado", "Atividade 3", "Sim", "Sim"]);

  const colaboradores = pasta.getWorksheet("Colaboradores");
  assert.deepEqual(linhaDe(colaboradores, 2).slice(4), [1, 2, 20, 1000, 100, 1100, 0]);
  assert.deepEqual(
    linhaDe(colaboradores, 3).slice(4),
    [1, 1, 4, 0, 0, 0, 4],
    "Horas sem valor/hora aparecem.",
  );

  const ocorrencias = pasta.getWorksheet("Ocorrências");
  const tipos = [];
  ocorrencias.eachRow((linha, numero) => numero > 1 && tipos.push(linha.getCell(1).value));
  assert.ok(tipos.includes("Sem valor/hora"));
  assert.ok(tipos.includes("Sem vínculo de equipe"));
});

test("sem período, a assertividade vai como porcentagem do Excel", async (t) => {
  const banco = simular({ carregados: [projetos[0]] });
  t.after(() => banco.restaurar());
  const pasta = await abrir((await relatoriosService.indicadoresXlsx({})).arquivo);
  const projetosAba = pasta.getWorksheet("Projetos");
  assert.equal(projetosAba.getCell("J2").value, 1, "1100 ÷ 1100 = 100%.");
  assert.equal(projetosAba.getCell("J2").numFmt, "0.00%");
  const resumo = pasta.getWorksheet("Resumo");
  assert.equal(procurar(resumo, "Assertividade média do orçamento").value, 1);
  assert.equal(procurar(resumo, "Período (data dos apontamentos)").value, "Todos os períodos");
});

test("recorte vazio gera abas com cabeçalho e aviso, sem tabela vazia", async (t) => {
  const banco = simular({ carregados: [] });
  t.after(() => banco.restaurar());
  const pasta = await abrir((await relatoriosService.indicadoresXlsx({})).arquivo);
  for (const nome of ["Projetos", "Clientes", "Colaboradores", "Apontamentos", "Ocorrências"]) {
    const aba = pasta.getWorksheet(nome);
    assert.equal(aba.getCell("A2").value, "Sem dados no recorte selecionado.", nome);
  }
  assert.equal(procurar(pasta.getWorksheet("Resumo"), "Projetos no recorte").value, 0);
});
