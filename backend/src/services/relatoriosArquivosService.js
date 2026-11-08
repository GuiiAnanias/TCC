import PDFDocument from "pdfkit";
import { relatoriosGeradosService } from "./relatoriosGeradosService.js";
import { HttpError } from "../utils/HttpError.js";
import {
  FORMATOS,
  dataBr,
  escreverTabela,
  escreverTitulo,
  novaPasta,
  paraBuffer,
} from "../utils/planilha.js";

// Arquivos de um relatório gerado: leem só a fotografia gravada, nunca recalculam.
// Formatos de fotografia que estes arquivos sabem ler (o 2 acrescenta os clientes).
export const VERSOES_EXPORTAVEIS = [1, 2];

const BLOCOS = {
  PROJETOS: "Projetos",
  CLIENTES: "Clientes",
  HORAS: "Horas totais",
  CUSTO: "Custo total",
  INCONSISTENCIAS: "Inconsistências",
};
const STATUS_PROJETO = {
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};
const STATUS_HORAS = { PENDENTE: "Pendente", APROVADO: "Aprovado", FATURADO: "Faturado" };
const OCORRENCIAS = {
  SEM_REMUNERACAO: "Sem valor/hora",
  SEM_VINCULO: "Sem participação na equipe",
  SEM_TAREFA: "Horas sem tarefa",
  SEM_ESTIMATIVA: "Tarefa sem estimativa",
  CONCLUIDA_SEM_HORAS: "Tarefa concluída sem horas",
};
const AVISO = "Uso interno: contém custos e valor/hora. Não enviar ao cliente.";

// O Intl separa "R$" do número com espaço sem quebra; a fonte padrão do PDF prefere o comum.
const espacos = (texto) => texto.replace(/[\u00a0\u202f]/g, " ");
const numero = (valor) =>
  espacos(new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(valor));
const moeda = (valor) =>
  espacos(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor));
const percentual = (valor) => (valor == null ? "Indisponível" : `${numero(valor)}%`);
const horas = (valor) => `${numero(valor)} h`;
const dataHora = (valor) =>
  espacos(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(valor)),
  );

export function textoPeriodo({ dataInicio, dataFim } = {}) {
  if (dataInicio && dataFim) return `${dataBr(dataInicio)} a ${dataBr(dataFim)}`;
  if (dataInicio) return `A partir de ${dataBr(dataInicio)}`;
  if (dataFim) return `Até ${dataBr(dataFim)}`;
  return "Todos os períodos";
}

function projetosEscolhidos(conteudo) {
  const ids = new Set(conteudo.filtros?.projetoIds ?? []);
  const nomes = conteudo.projetos.filter((row) => ids.has(row.id)).map((row) => row.nome);
  return nomes.length ? nomes.join(", ") : "Todos com dados no período";
}

/** Nomes dos clientes escolhidos (formato 2), a partir dos projetos gravados na fotografia. */
function clientesEscolhidos(conteudo) {
  const ids = new Set(conteudo.filtros?.clienteIds ?? []);
  return [
    ...new Map(
      conteudo.projetos
        .filter((row) => ids.has(row.clienteId))
        .map((row) => [row.clienteId, row.cliente]),
    ).values(),
  ];
}

const slug = (texto) =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

/** Nome do arquivo com o número do relatório, o recorte e a extensão. */
export function nomeArquivo(relatorio, extensao) {
  const { filtros = {}, projetos = [] } = relatorio.conteudo;
  const escolhidos = filtros.projetoIds ?? [];
  const clientes = clientesEscolhidos(relatorio.conteudo);
  const projeto =
    clientes.length === 1
      ? `cliente-${slug(clientes[0])}`
      : clientes.length > 1
        ? `${clientes.length}-clientes`
        : escolhidos.length === 1
          ? slug(projetos.find((row) => row.id === escolhidos[0])?.nome ?? "projeto")
          : escolhidos.length > 1
            ? `${escolhidos.length}-projetos`
            : "todos-os-projetos";
  const periodo =
    filtros.dataInicio && filtros.dataFim
      ? `${filtros.dataInicio}-a-${filtros.dataFim}`
      : filtros.dataInicio
        ? `desde-${filtros.dataInicio}`
        : filtros.dataFim
          ? `ate-${filtros.dataFim}`
          : "todos-os-periodos";
  return `relatorio-${relatorio.id}-${projeto || "projeto"}-${periodo}.${extensao}`;
}

/** Linhas de cada bloco no formato das tabelas, iguais na prévia, no PDF e no Excel. */
const tabelas = {
  PROJETOS: (dados) => [
    {
      titulo: "Projetos do recorte",
      nome: "Projetos",
      colunas: [
        { titulo: "Projeto", chave: "nome", largura: 30, peso: 1.6 },
        { titulo: "Cliente", chave: "cliente", largura: 30, peso: 1.8 },
        { titulo: "Status", chave: "status", largura: 12, peso: 0.75 },
        { titulo: "Orçamento", chave: "orcamento", formato: FORMATOS.moeda, texto: moeda },
        { titulo: "Horas", chave: "horas", formato: FORMATOS.numero, texto: horas, peso: 0.7 },
        { titulo: "Custo base", chave: "custoBase", formato: FORMATOS.moeda, texto: moeda },
        { titulo: "Bonificação", chave: "bonificacao", formato: FORMATOS.moeda, texto: moeda },
        { titulo: "Custo total", chave: "custo", formato: FORMATOS.moeda, texto: moeda },
        {
          titulo: "Horas sem custo",
          chave: "horasSemCusto",
          formato: FORMATOS.numero,
          texto: horas,
          peso: 0.8,
        },
        {
          titulo: "Assertividade do orçamento",
          chave: "assertividade",
          formato: FORMATOS.percentual,
          texto: percentual,
          planilha: (valor) => (valor == null ? null : valor / 100),
        },
        {
          titulo: "Inconsistências",
          chave: "inconsistencias",
          formato: FORMATOS.inteiro,
          peso: 1.15,
        },
      ],
      linhas: dados.linhas.map((row) => ({
        ...row,
        status: STATUS_PROJETO[row.status] ?? row.status,
      })),
    },
  ],
  CLIENTES: (dados) => [
    {
      titulo: "Clientes do recorte",
      nome: "Clientes",
      colunas: [
        { titulo: "Cliente", chave: "nome", largura: 40, peso: 2.4 },
        { titulo: "Projetos", chave: "projetos", formato: FORMATOS.inteiro, peso: 0.7 },
        { titulo: "Horas", chave: "horas", formato: FORMATOS.numero, texto: horas },
        { titulo: "Custo base", chave: "custoBase", formato: FORMATOS.moeda, texto: moeda },
        { titulo: "Bonificação", chave: "bonificacao", formato: FORMATOS.moeda, texto: moeda },
        { titulo: "Custo total", chave: "custo", formato: FORMATOS.moeda, texto: moeda },
      ],
      linhas: dados.linhas,
    },
  ],
  HORAS: (dados) => [
    {
      titulo: "Horas por status do apontamento",
      nome: "HorasPorStatus",
      colunas: [
        { titulo: "Status", chave: "status", largura: 20 },
        { titulo: "Horas", chave: "horas", formato: FORMATOS.numero, texto: horas },
      ],
      linhas: Object.keys(STATUS_HORAS).map((status) => ({
        status: STATUS_HORAS[status],
        horas: dados.porStatus?.[status] ?? 0,
      })),
    },
    {
      titulo: "Horas por colaborador",
      nome: "HorasPorColaborador",
      colunas: [
        { titulo: "Colaborador", chave: "nome", largura: 32, peso: 2 },
        { titulo: "Departamento", chave: "departamento", largura: 24, peso: 1.4 },
        { titulo: "Projetos", chave: "projetos", formato: FORMATOS.inteiro, peso: 0.7 },
        { titulo: "Horas", chave: "horas", formato: FORMATOS.numero, texto: horas, peso: 0.8 },
      ],
      linhas: dados.porColaborador.map((row) => ({
        ...row,
        departamento: row.departamento || "Sem departamento",
      })),
    },
  ],
  CUSTO: () => [],
  INCONSISTENCIAS: (dados) => [
    {
      titulo: `${dados.total} ocorrência(s) no recorte`,
      nome: "Ocorrencias",
      colunas: [
        { titulo: "Tipo", chave: "tipo", largura: 26, peso: 1.2 },
        { titulo: "Projeto", chave: "projeto", largura: 30, peso: 1.3 },
        { titulo: "Colaborador ou tarefa", chave: "alvo", largura: 30, peso: 1.3 },
        { titulo: "Data", chave: "data", largura: 12, peso: 0.7 },
        { titulo: "Descrição", chave: "descricao", largura: 50, peso: 2.2 },
      ],
      linhas: dados.ocorrencias.map((row) => ({
        tipo: OCORRENCIAS[row.tipo] ?? row.tipo,
        projeto: row.projeto,
        alvo: row.colaborador || row.tarefa || "—",
        data: row.data ? dataBr(row.data) : "—",
        descricao: row.descricao,
      })),
    },
  ],
};

/** Indicadores resumidos de cada bloco: rótulo, valor exibido, valor numérico e observação. */
const indicadores = {
  PROJETOS: () => [],
  CLIENTES: () => [],
  HORAS: (dados) => [
    ["Horas totais", horas(dados.total), dados.total, `${dados.apontamentos} apontamentos`],
    ["Horas sem custo", horas(dados.horasSemCusto), dados.horasSemCusto, "Sem valor/hora vigente"],
    [
      "Horas sem tarefa",
      horas(dados.horasSemTarefa),
      dados.horasSemTarefa,
      "Correção não classificada",
    ],
  ],
  CUSTO: (dados) => [
    [
      "Custo total",
      moeda(dados.total),
      dados.total,
      dados.parcial ? `Parcial: ${horas(dados.horasSemCusto)} sem valor/hora` : "",
    ],
    ["Custo base", moeda(dados.custoBase), dados.custoBase, ""],
    ["Bonificação", moeda(dados.bonificacao), dados.bonificacao, ""],
    [
      "Assertividade média do orçamento",
      percentual(dados.assertividadeMedia),
      dados.assertividadeMedia == null ? null : dados.assertividadeMedia / 100,
      dados.assertividadeMedia == null
        ? "Sem projetos com base de cálculo no recorte"
        : `${dados.projetosComAssertividade} projeto(s) com base de cálculo`,
    ],
  ],
  INCONSISTENCIAS: (dados) =>
    Object.entries(OCORRENCIAS).map(([tipo, rotulo]) => [
      rotulo,
      String(dados.porTipo?.[tipo] ?? 0),
      dados.porTipo?.[tipo] ?? 0,
      "",
    ]),
};
const formatoIndicador = (bloco, rotulo) =>
  bloco === "CUSTO"
    ? rotulo.startsWith("Assertividade")
      ? FORMATOS.percentual
      : FORMATOS.moeda
    : bloco === "HORAS"
      ? FORMATOS.numero
      : FORMATOS.inteiro;

function cabecalho(relatorio) {
  const { conteudo } = relatorio;
  return [
    ["Relatório nº", String(relatorio.id)],
    ["Gerado em", `${dataHora(relatorio.criadoEm)} (horário de Brasília)`],
    ["Gerado por", relatorio.autor ?? "Usuário removido"],
    ["Versão do formato", String(relatorio.versao)],
    ["Período", textoPeriodo(conteudo.filtros)],
    ...(conteudo.filtros?.clienteIds?.length
      ? [["Clientes escolhidos", clientesEscolhidos(conteudo).join(", ") || "—"]]
      : []),
    ["Projetos selecionados", projetosEscolhidos(conteudo)],
    ["Projetos no recorte", String(conteudo.projetos.length)],
    ["Blocos", conteudo.blocos.map((bloco) => BLOCOS[bloco] ?? bloco).join(", ")],
  ];
}

function conferirVersao(relatorio) {
  if (!VERSOES_EXPORTAVEIS.includes(relatorio.versao))
    throw new HttpError(
      409,
      `Este relatório foi gravado no formato ${relatorio.versao}, que esta versão do sistema não exporta.`,
    );
}

// --- Excel ---

function escreverPares(aba, inicio, pares, formatos = []) {
  pares.forEach(([rotulo, texto, valor, nota], indice) => {
    const linha = aba.getRow(inicio + indice);
    linha.getCell(1).value = rotulo;
    linha.getCell(1).font = { bold: true };
    linha.getCell(2).value = valor === undefined ? texto : valor;
    if (formatos[indice]) linha.getCell(2).numFmt = formatos[indice];
    if (nota) linha.getCell(3).value = nota;
  });
  return inicio + pares.length;
}

export async function montarExcelRelatorio(relatorio) {
  conferirVersao(relatorio);
  const { conteudo } = relatorio;
  const pasta = novaPasta();
  const resumo = pasta.addWorksheet("Relatório", {
    properties: { tabColor: { argb: "FF1F4E5F" } },
  });
  escreverTitulo(
    resumo,
    `CODE BI — Relatório nº ${relatorio.id}`,
    "Cópia dos dados no momento da geração",
  );
  resumo.getCell("A3").value = AVISO;
  resumo.getCell("A3").font = { bold: true, color: { argb: "FF9C2A00" } };
  resumo.getColumn(1).width = 26;
  resumo.getColumn(2).width = 60;
  resumo.getColumn(3).width = 40;
  const fim = escreverPares(resumo, 5, cabecalho(relatorio));
  escreverTabela(resumo, {
    nome: "ProjetosDoRecorte",
    linhaInicial: fim + 1,
    colunas: [
      { titulo: "Projeto do recorte", chave: "nome", largura: 26 },
      { titulo: "Cliente", chave: "cliente", largura: 60 },
      { titulo: "Status", chave: "status", largura: 40 },
    ],
    linhas: conteudo.projetos.map((row) => ({
      ...row,
      status: STATUS_PROJETO[row.status] ?? row.status,
    })),
  });
  // Nesta aba o cabeçalho do relatório vem antes da tabela: nada fica congelado.
  resumo.views = [];

  for (const bloco of conteudo.blocos) {
    const dados = conteudo.dados[bloco];
    const pares = indicadores[bloco](dados);
    const listas = tabelas[bloco](dados);
    // Com indicadores e uma tabela, a tabela vai logo abaixo; outras tabelas ganham aba própria.
    const [primeira, ...demais] = listas;
    const aba = pasta.addWorksheet(BLOCOS[bloco]);
    let linha = 1;
    if (pares.length) {
      aba.getColumn(1).width = 34;
      aba.getColumn(2).width = 18;
      aba.getColumn(3).width = 44;
      linha =
        escreverPares(
          aba,
          1,
          pares.map(([rotulo, , valor, nota]) => [rotulo, null, valor, nota]),
          pares.map(([rotulo]) => formatoIndicador(bloco, rotulo)),
        ) + 1;
    }
    for (const [indice, tabela] of [primeira, ...demais].filter(Boolean).entries()) {
      const destino = indice === 0 ? aba : pasta.addWorksheet(tabela.titulo.slice(0, 31));
      escreverTabela(destino, {
        nome: tabela.nome,
        linhaInicial: indice === 0 ? linha : 1,
        colunas: tabela.colunas.map((coluna) => ({
          titulo: coluna.titulo,
          chave: coluna.chave,
          largura: coluna.largura ?? 16,
          formato: coluna.formato,
        })),
        linhas: tabela.linhas.map((row) =>
          Object.fromEntries(
            tabela.colunas.map((coluna) => [
              coluna.chave,
              coluna.planilha ? coluna.planilha(row[coluna.chave]) : row[coluna.chave],
            ]),
          ),
        ),
      });
      // A coluna A também guarda os rótulos dos indicadores escritos acima da tabela.
      if (indice === 0 && pares.length)
        aba.getColumn(1).width = Math.max(aba.getColumn(1).width ?? 0, 34);
    }
  }
  return paraBuffer(pasta);
}

// --- PDF ---

const CORES = {
  texto: "#1d2939",
  suave: "#667085",
  linha: "#d0d5dd",
  cabecalho: "#1f4e5f",
  fundo: "#f2f4f7",
  aviso: "#9c2a00",
};
const ESPACO = 5;

function desenharTabela(doc, { colunas, linhas, vazio }) {
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pesos = colunas.map((coluna) => coluna.peso ?? 1);
  const total = pesos.reduce((soma, peso) => soma + peso, 0);
  const larguras = pesos.map((peso) => (largura * peso) / total);
  const limite = () => doc.page.height - doc.page.margins.bottom;
  const altura = (textos, fonte) => {
    doc.font(fonte).fontSize(8);
    return (
      Math.max(
        ...textos.map((texto, i) => doc.heightOfString(texto, { width: larguras[i] - ESPACO * 2 })),
      ) +
      ESPACO * 2
    );
  };
  const desenharLinha = (textos, { fonte, fundo, cor }) => {
    const y = doc.y;
    const h = altura(textos, fonte);
    let x = doc.page.margins.left;
    if (fundo) doc.rect(x, y, largura, h).fill(fundo);
    doc.font(fonte).fontSize(8).fillColor(cor);
    textos.forEach((texto, i) => {
      doc.text(texto, x + ESPACO, y + ESPACO, {
        width: larguras[i] - ESPACO * 2,
        align: colunas[i].direita ? "right" : "left",
      });
      x += larguras[i];
    });
    doc
      .moveTo(doc.page.margins.left, y + h)
      .lineTo(doc.page.margins.left + largura, y + h)
      .lineWidth(0.5)
      .strokeColor(CORES.linha)
      .stroke();
    doc.x = doc.page.margins.left;
    doc.y = y + h;
  };
  const titulos = colunas.map((coluna) => coluna.titulo);
  const desenharCabecalho = () =>
    desenharLinha(titulos, { fonte: "Helvetica-Bold", fundo: CORES.cabecalho, cor: "#ffffff" });
  if (!linhas.length) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(CORES.suave).text(vazio);
    doc.moveDown(0.5);
    return;
  }
  desenharCabecalho();
  linhas.forEach((textos, indice) => {
    // A linha nunca é cortada entre páginas; na página nova o cabeçalho se repete.
    if (doc.y + altura(textos, "Helvetica") > limite()) {
      doc.addPage();
      desenharCabecalho();
    }
    desenharLinha(textos, {
      fonte: "Helvetica",
      fundo: indice % 2 ? CORES.fundo : null,
      cor: CORES.texto,
    });
  });
  doc.moveDown(0.8);
}

function textosDaTabela(tabela) {
  return tabela.linhas.map((row) =>
    tabela.colunas.map((coluna) => {
      const valor = row[coluna.chave];
      if (coluna.texto) return coluna.texto(valor);
      return valor == null ? "—" : String(valor);
    }),
  );
}

function garantirEspaco(doc, altura) {
  if (doc.y + altura > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

export async function montarPdfRelatorio(relatorio, { compress = true } = {}) {
  conferirVersao(relatorio);
  const { conteudo } = relatorio;
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 48, left: 40, right: 40 },
    bufferPages: true,
    compress,
    info: {
      Title: `CODE BI — Relatório nº ${relatorio.id}`,
      Author: "CODE BI",
      Subject: `Relatório nº ${relatorio.id}, versão ${relatorio.versao} do formato`,
    },
  });
  const partes = [];
  doc.on("data", (parte) => partes.push(parte));
  const pronto = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(CORES.cabecalho)
    .text(`Relatório nº ${relatorio.id}`);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(CORES.suave)
    .text("Cópia dos dados no momento da geração. Mudanças posteriores não alteram este arquivo.");
  doc.font("Helvetica-Bold").fillColor(CORES.aviso).text(AVISO);
  doc.moveDown(0.6);
  for (const [rotulo, valor] of cabecalho(relatorio).slice(1)) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(CORES.texto)
      .text(`${rotulo}: `, { continued: true });
    doc.font("Helvetica").text(valor);
  }
  doc.moveDown(0.8);

  for (const bloco of conteudo.blocos) {
    const dados = conteudo.dados[bloco];
    const pares = indicadores[bloco](dados);
    const listas = tabelas[bloco](dados);
    // Título junto do começo do conteúdo: nunca sozinho no fim da página.
    garantirEspaco(doc, 90);
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(CORES.cabecalho)
      .text(BLOCOS[bloco] ?? bloco);
    doc.moveDown(0.3);
    if (pares.length)
      desenharTabela(doc, {
        colunas: [
          { titulo: "Indicador", peso: 1.4 },
          { titulo: "Valor", peso: 1 },
          { titulo: "Observação", peso: 2 },
        ],
        linhas: pares.map(([rotulo, texto, , nota]) => [rotulo, texto, nota || "—"]),
      });
    for (const tabela of listas) {
      garantirEspaco(doc, 70);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(CORES.suave).text(tabela.titulo);
      doc.moveDown(0.3);
      desenharTabela(doc, {
        colunas: tabela.colunas.map((coluna) => ({
          ...coluna,
          direita: Boolean(coluna.formato),
        })),
        linhas: textosDaTabela(tabela),
        vazio: "Sem dados no recorte.",
      });
    }
  }

  // Rodapé numerado em todas as páginas, depois que o total de páginas é conhecido.
  const { start, count } = doc.bufferedPageRange();
  for (let indice = start; indice < start + count; indice++) {
    doc.switchToPage(indice);
    const margem = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(CORES.suave)
      .text(
        `CODE BI · Relatório nº ${relatorio.id} · ${AVISO} · Página ${indice + 1} de ${count}`,
        doc.page.margins.left,
        doc.page.height - 30,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
          lineBreak: false,
        },
      );
    doc.page.margins.bottom = margem;
  }
  doc.end();
  return pronto;
}

export const relatoriosArquivosService = {
  async pdf(id) {
    const relatorio = await relatoriosGeradosService.buscar(id);
    return { arquivo: await montarPdfRelatorio(relatorio), nome: nomeArquivo(relatorio, "pdf") };
  },
  async xlsx(id) {
    const relatorio = await relatoriosGeradosService.buscar(id);
    return {
      arquivo: await montarExcelRelatorio(relatorio),
      nome: nomeArquivo(relatorio, "xlsx"),
    };
  },
};
