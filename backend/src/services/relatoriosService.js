import { dashboardService } from "./dashboardService.js";
import { round } from "./operationalIndicators.js";
import {
  FORMATOS,
  dataBr,
  dataUtc,
  escreverTabela,
  escreverTitulo,
  estilizarCabecalho,
  novaPasta,
  paraBuffer,
} from "../utils/planilha.js";

const STATUS = { PENDENTE: "Pendente", APROVADO: "Aprovado", FATURADO: "Faturado" };
const STATUS_PROJETO = {
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};
const OCORRENCIAS = {
  SEM_VINCULO: "Sem vínculo de equipe",
  SEM_REMUNERACAO: "Sem valor/hora",
  SEM_TAREFA: "Apontamento sem tarefa",
  SEM_ESTIMATIVA: "Tarefa sem estimativa",
  CONCLUIDA_SEM_HORAS: "Tarefa concluída sem horas",
};

// Os indicadores chegam em pontos percentuais (137,5); no Excel vão como fração (1,375)
// com formato de porcentagem, que é o que o Power BI espera.
const fracao = (valor) => (valor == null ? null : valor / 100);
const simNao = (valor) => (valor ? "Sim" : "Não");
const dia = (valor) => (valor ? dataUtc(String(valor).slice(0, 10)) : null);

function textoPeriodo({ dataInicio, dataFim }) {
  const br = (data) => dataBr(new Date(data).toISOString().slice(0, 10));
  if (dataInicio && dataFim) return `${br(dataInicio)} a ${br(dataFim)}`;
  if (dataInicio) return `A partir de ${br(dataInicio)}`;
  if (dataFim) return `Até ${br(dataFim)}`;
  return "Todos os períodos";
}

function agregarColaboradores(apontamentos) {
  const pessoas = new Map();
  for (const linha of apontamentos) {
    if (!pessoas.has(linha.colaboradorId))
      pessoas.set(linha.colaboradorId, {
        colaborador: linha.colaborador,
        email: linha.email,
        departamento: linha.departamento,
        cargo: linha.cargo,
        projetos: new Set(),
        apontamentos: 0,
        horas: 0,
        custoBase: 0,
        bonificacao: 0,
        custo: 0,
        horasSemCusto: 0,
      });
    const pessoa = pessoas.get(linha.colaboradorId);
    pessoa.projetos.add(linha.projetoId);
    pessoa.apontamentos++;
    for (const campo of ["horas", "custoBase", "bonificacao", "custo"])
      pessoa[campo] = round(pessoa[campo] + linha[campo]);
    if (linha.semCusto) pessoa.horasSemCusto = round(pessoa.horasSemCusto + linha.horas);
  }
  return [...pessoas.values()]
    .map((pessoa) => ({ ...pessoa, projetos: pessoa.projetos.size }))
    .sort((a, b) => b.horas - a.horas || a.colaborador.localeCompare(b.colaborador, "pt-BR"));
}

function abaResumo(pasta, relatorio, geradoEm) {
  const aba = pasta.addWorksheet("Resumo", { properties: { tabColor: { argb: "FF1F4E5F" } } });
  const { resumo, filtros = {}, nomesFiltros = {} } = relatorio;
  escreverTitulo(
    aba,
    "CODE BI — Relatório de indicadores",
    `Gerado em ${geradoEm} (horário de Brasília)`,
  );
  aba.getCell("A3").value = "Uso interno: contém custos e valor/hora. Não enviar ao cliente.";
  aba.getCell("A3").font = { bold: true, color: { argb: "FFB42318" } };

  let linha = 5;
  const secao = (titulo) => {
    const cabecalho = aba.getRow(linha);
    cabecalho.values = [titulo, ""];
    estilizarCabecalho(cabecalho, 2);
    linha++;
  };
  const item = (rotulo, valor, formato) => {
    const atual = aba.getRow(linha);
    atual.getCell(1).value = rotulo;
    atual.getCell(2).value = valor ?? "Indisponível";
    if (formato && valor != null) atual.getCell(2).numFmt = formato;
    atual.getCell(2).alignment = { horizontal: "right" };
    linha++;
  };

  secao("Filtros aplicados");
  item("Período (data dos apontamentos)", textoPeriodo(filtros));
  item("Cliente", nomesFiltros.cliente ?? "Todos");
  item("Projetos", nomesFiltros.projetos?.length ? nomesFiltros.projetos.join("; ") : "Todos");
  item("Colaborador", nomesFiltros.colaborador ?? "Todos");
  item("Equipe (departamento)", filtros.equipe ?? "Todas");
  item("Sprint", nomesFiltros.sprint ?? "Todas");
  item("Status do projeto", STATUS_PROJETO[filtros.statusProjeto] ?? "Todos os estados");

  linha++;
  secao("Indicadores");
  item("Projetos no recorte", resumo.projetos, FORMATOS.inteiro);
  item("Projetos ativos", resumo.projetosAtivos, FORMATOS.inteiro);
  item("Clientes atendidos", resumo.clientes, FORMATOS.inteiro);
  item("Horas trabalhadas", resumo.horas, FORMATOS.numero);
  item("Custo total (R$)", resumo.custo, FORMATOS.moeda);
  item("Custo base (R$)", resumo.custoBase, FORMATOS.moeda);
  item("Bonificação (R$)", resumo.bonificacao, FORMATOS.moeda);
  item("Horas sem valor/hora", resumo.horasSemCusto, FORMATOS.numero);
  item("Assertividade média do orçamento", fracao(resumo.assertividade), FORMATOS.percentual);
  item("Projetos com assertividade calculada", resumo.projetosComAssertividade, FORMATOS.inteiro);
  item(
    "Assertividade das estimativas",
    fracao(resumo.assertividadeEstimativas),
    FORMATOS.percentual,
  );
  item("Horas de correção", resumo.horasCorrecao, FORMATOS.numero);
  item("Percentual de correções", fracao(resumo.percentualCorrecoes), FORMATOS.percentual);
  item("Tarefas concluídas", resumo.tarefasConcluidas, FORMATOS.inteiro);
  item(
    "Tarefas concluídas sem horas",
    fracao(resumo.percentualTarefasSemHoras),
    FORMATOS.percentual,
  );
  item(
    "Tarefas sem estimativa",
    fracao(resumo.percentualTarefasSemEstimativa),
    FORMATOS.percentual,
  );
  item("Ocorrências de auditoria", resumo.totalOcorrencias, FORMATOS.inteiro);

  linha++;
  aba.mergeCells(`A${linha}:B${linha}`);
  const nota = aba.getCell(`A${linha}`);
  nota.value =
    "Assertividade do orçamento = orçamento ÷ custo × 100, por projeto. A média usa só os projetos com base completa, como no dashboard.";
  nota.font = { italic: true, color: { argb: "FF555555" } };
  nota.alignment = { wrapText: true, vertical: "top" };
  aba.getRow(linha).height = 30;
  aba.getColumn(1).width = 42;
  aba.getColumn(2).width = 26;
}

const colunasProjetos = [
  { titulo: "Projeto", chave: "nome", largura: 32 },
  { titulo: "Cliente", chave: "cliente", largura: 28 },
  { titulo: "Status", chave: "status", largura: 10 },
  { titulo: "Orçamento (R$)", chave: "orcamento", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Custo total (R$)", chave: "custo", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Custo base (R$)", chave: "custoBase", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Bonificação (R$)", chave: "bonificacao", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Horas", chave: "horas", largura: 10, formato: FORMATOS.numero },
  { titulo: "Horas sem valor/hora", chave: "horasSemCusto", largura: 14, formato: FORMATOS.numero },
  {
    titulo: "Assertividade do orçamento",
    chave: "assertividade",
    largura: 16,
    formato: FORMATOS.percentual,
  },
  { titulo: "Tarefas concluídas", chave: "tarefasConcluidas", largura: 12 },
  {
    titulo: "Assertividade das estimativas",
    chave: "assertividadeEstimativas",
    largura: 16,
    formato: FORMATOS.percentual,
  },
  {
    titulo: "Correções (%)",
    chave: "percentualCorrecoes",
    largura: 12,
    formato: FORMATOS.percentual,
  },
  { titulo: "Inconsistências", chave: "inconsistencias", largura: 14 },
];

const colunasClientes = [
  { titulo: "Cliente", chave: "nome", largura: 32 },
  { titulo: "Projetos", chave: "projetos", largura: 10 },
  { titulo: "Horas", chave: "horas", largura: 10, formato: FORMATOS.numero },
  { titulo: "Custo total (R$)", chave: "custo", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Custo base (R$)", chave: "custoBase", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Bonificação (R$)", chave: "bonificacao", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Horas sem valor/hora", chave: "horasSemCusto", largura: 14, formato: FORMATOS.numero },
];

const colunasColaboradores = [
  { titulo: "Colaborador", chave: "colaborador", largura: 30 },
  { titulo: "E-mail", chave: "email", largura: 30 },
  { titulo: "Departamento", chave: "departamento", largura: 20 },
  { titulo: "Cargo", chave: "cargo", largura: 22 },
  { titulo: "Projetos", chave: "projetos", largura: 10 },
  { titulo: "Apontamentos", chave: "apontamentos", largura: 13 },
  { titulo: "Horas", chave: "horas", largura: 10, formato: FORMATOS.numero },
  { titulo: "Custo base (R$)", chave: "custoBase", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Bonificação (R$)", chave: "bonificacao", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Custo total (R$)", chave: "custo", largura: 16, formato: FORMATOS.moeda },
  { titulo: "Horas sem valor/hora", chave: "horasSemCusto", largura: 14, formato: FORMATOS.numero },
];

const colunasApontamentos = [
  { titulo: "ID", chave: "id", largura: 8 },
  { titulo: "Data", chave: "data", largura: 12, formato: FORMATOS.data },
  { titulo: "Cliente", chave: "cliente", largura: 26 },
  { titulo: "Projeto", chave: "projeto", largura: 30 },
  { titulo: "Tarefa", chave: "tarefa", largura: 30 },
  { titulo: "Colaborador", chave: "colaborador", largura: 28 },
  { titulo: "E-mail", chave: "email", largura: 28 },
  { titulo: "Departamento", chave: "departamento", largura: 18 },
  { titulo: "Cargo", chave: "cargo", largura: 20 },
  { titulo: "Papel no projeto", chave: "papel", largura: 16 },
  { titulo: "Nível", chave: "nivel", largura: 12 },
  { titulo: "Valor/hora (R$)", chave: "valorHora", largura: 14, formato: FORMATOS.moeda },
  { titulo: "Horas", chave: "horas", largura: 9, formato: FORMATOS.numero },
  { titulo: "Custo base (R$)", chave: "custoBase", largura: 15, formato: FORMATOS.moeda },
  { titulo: "Bonificação (%)", chave: "percentual", largura: 13, formato: FORMATOS.percentual },
  { titulo: "Bonificação (R$)", chave: "bonificacao", largura: 15, formato: FORMATOS.moeda },
  { titulo: "Custo total (R$)", chave: "custo", largura: 15, formato: FORMATOS.moeda },
  { titulo: "Status", chave: "status", largura: 11 },
  { titulo: "Descrição", chave: "descricao", largura: 40 },
  { titulo: "Sem valor/hora", chave: "semCusto", largura: 13 },
  { titulo: "Sem vínculo de equipe", chave: "semVinculo", largura: 15 },
];

const colunasOcorrencias = [
  { titulo: "Tipo", chave: "tipo", largura: 26 },
  { titulo: "Projeto", chave: "projeto", largura: 30 },
  { titulo: "Colaborador", chave: "colaborador", largura: 28 },
  { titulo: "Tarefa", chave: "tarefa", largura: 30 },
  { titulo: "Data", chave: "data", largura: 12, formato: FORMATOS.data },
  { titulo: "Descrição", chave: "descricao", largura: 60 },
];

/** Monta a pasta de trabalho a partir do retorno de `dashboardService.report`. */
export async function montarPlanilhaIndicadores(relatorio, { geradoEm }) {
  const pasta = novaPasta();
  abaResumo(pasta, relatorio, geradoEm);

  escreverTabela(pasta.addWorksheet("Projetos"), {
    nome: "Projetos",
    colunas: colunasProjetos,
    linhas: relatorio.projetos.map((projeto) => ({
      ...projeto,
      status: STATUS_PROJETO[projeto.status] ?? projeto.status,
      assertividade: fracao(projeto.assertividade),
      tarefasConcluidas: projeto.operacionais?.tarefasConcluidas ?? null,
      assertividadeEstimativas: fracao(projeto.operacionais?.assertividadeEstimativas),
      percentualCorrecoes: fracao(projeto.operacionais?.percentualCorrecoes),
    })),
  });
  escreverTabela(pasta.addWorksheet("Clientes"), {
    nome: "Clientes",
    colunas: colunasClientes,
    linhas: relatorio.clientes,
  });
  escreverTabela(pasta.addWorksheet("Colaboradores"), {
    nome: "Colaboradores",
    colunas: colunasColaboradores,
    linhas: agregarColaboradores(relatorio.apontamentos),
  });
  escreverTabela(pasta.addWorksheet("Apontamentos"), {
    nome: "Apontamentos",
    colunas: colunasApontamentos,
    linhas: relatorio.apontamentos.map((linha) => ({
      ...linha,
      data: dia(linha.data),
      status: STATUS[linha.status] ?? linha.status,
      percentual: linha.percentual ? linha.percentual / 100 : 0,
      semCusto: simNao(linha.semCusto),
      semVinculo: simNao(linha.semVinculo),
    })),
  });
  escreverTabela(pasta.addWorksheet("Ocorrências"), {
    nome: "Ocorrencias",
    colunas: colunasOcorrencias,
    linhas: relatorio.ocorrencias.map((linha) => ({
      ...linha,
      tipo: OCORRENCIAS[linha.tipo] ?? linha.tipo,
      colaborador: linha.colaborador ?? null,
      tarefa: linha.tarefa ?? null,
      data: dia(linha.data),
    })),
  });
  return paraBuffer(pasta);
}

const formatarAgora = (agora) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(agora);

export const relatoriosService = {
  async indicadoresXlsx(filtros, agora = new Date()) {
    const relatorio = await dashboardService.report(filtros);
    const arquivo = await montarPlanilhaIndicadores(relatorio, { geradoEm: formatarAgora(agora) });
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
    return { arquivo, nome: `indicadores-codebi-${hoje}.xlsx` };
  },

  async obterPrevia(filtros) {
    // Garante que o dashboardService receba os filtros de projetoIds e clienteId corretamente
    const relatorio = await dashboardService.report(filtros);

    // Se houver projetos específicos filtrados, podemos refinar os blocos de clientes e ocorrências para exibir apenas o pertinente
    let projetosFiltrados = relatorio.projetos;
    let clientesFiltrados = relatorio.clientes;
    let ocorrenciasFiltradas = relatorio.ocorrencias;

    if (filtros.projetoIds && filtros.projetoIds.length > 0) {
      const idsStr = filtros.projetoIds.map(String);
      projetosFiltrados = relatorio.projetos.filter((p) => idsStr.includes(String(p.id)));

      // Puxa automaticamente apenas os clientes vinculados a esses projetos
      const nomesClientesValidos = new Set(projetosFiltrados.map((p) => p.cliente));
      clientesFiltrados = relatorio.clientes.filter((c) => nomesClientesValidos.has(c.nome));

      // Filtra as ocorrências apenas para os projetos selecionados
      const nomesProjetosValidos = new Set(projetosFiltrados.map((p) => p.nome));
      ocorrenciasFiltradas = relatorio.ocorrencias.filter((o) =>
        nomesProjetosValidos.has(o.projeto),
      );
    }

    return {
      filtrosAplicados: filtros,
      resumo: relatorio.resumo,
      projetos: projetosFiltrados,
      clientes: clientesFiltrados,
      colaboradores: agregarColaboradores(relatorio.apontamentos),
      ocorrencias: ocorrenciasFiltradas,
    };
  },

  // Novo método para persistir a "fotografia" (snapshot) dos resultados
  async salvarFotografia(usuarioId, filtros, dadosRelatorio) {
    return await prisma.relatoriosHistorico.create({
      data: {
        usuarioId,
        filtrosJson: JSON.stringify(filtros),
        snapshotJson: JSON.stringify(dadosRelatorio),
        criadoEm: new Date(),
      },
    });
  },
};
