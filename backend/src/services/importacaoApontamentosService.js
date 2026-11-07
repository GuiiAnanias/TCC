import { apontamentosRepository } from "../repositories/apontamentosRepository.js";
import { importacaoApontamentosRepository as repositorio } from "../repositories/importacaoApontamentosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { financeDay, todayFinanceDate } from "../utils/financeDates.js";
import {
  FORMATOS,
  dataBr,
  dataUtc,
  diaIso,
  escreverTitulo,
  estilizarCabecalho,
  lerPasta,
  normalizarTexto,
  novaPasta,
  paraBuffer,
  tamanhoDescompactado,
  valorDaCelula,
} from "../utils/planilha.js";

export const ABA_APONTAMENTOS = "Apontamentos";
export const LIMITE_LINHAS = 2000;
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;
// Um .xlsx de 2.000 linhas descompactado fica em poucos megabytes.
const TAMANHO_MAXIMO_DESCOMPACTADO = 100 * 1024 * 1024;
const LIMITE_HORAS_DIA = 24;
const DATA_MINIMA = "2000-01-01";

export const COLUNAS = [
  { chave: "data", titulo: "Data", obrigatoria: true, apelidos: ["data", "dia"] },
  {
    chave: "colaborador",
    titulo: "E-mail do colaborador",
    obrigatoria: true,
    apelidos: ["e-mail do colaborador", "email do colaborador", "colaborador", "e-mail", "email"],
  },
  { chave: "projeto", titulo: "Projeto", obrigatoria: true, apelidos: ["projeto"] },
  { chave: "tarefa", titulo: "Tarefa (opcional)", obrigatoria: false, apelidos: ["tarefa"] },
  {
    chave: "horas",
    titulo: "Horas",
    obrigatoria: true,
    apelidos: ["horas", "horas trabalhadas", "quantidade de horas"],
  },
  { chave: "status", titulo: "Status (opcional)", obrigatoria: false, apelidos: ["status"] },
  {
    chave: "descricao",
    titulo: "Descrição",
    obrigatoria: true,
    apelidos: ["descricao", "descricao da atividade", "atividade"],
  },
];
const TITULO = Object.fromEntries(COLUNAS.map((coluna) => [coluna.chave, coluna.titulo]));
const STATUS = { pendente: "PENDENTE", aprovado: "APROVADO", faturado: "FATURADO" };
const centesimos = (valor) => Math.round(Number(valor) * 100);
const horasTexto = (valor) => `${Number(valor).toLocaleString("pt-BR")} h`;
const vazio = (valor) => valor === null || valor === undefined || String(valor).trim() === "";
const comCodigo = /\[#(\d+)\]\s*$/;
// Cabeçalho comparado sem acento, maiúsculas e o que estiver entre parênteses.
const chaveCabecalho = (texto) => normalizarTexto(String(texto ?? "").replace(/\(.*?\)/g, ""));

// ---------------------------------------------------------------- leitura do arquivo

const arquivoInvalido = () =>
  new HttpError(
    400,
    "O arquivo não é uma planilha .xlsx. No Excel, use Salvar como > Pasta de Trabalho do Excel (.xlsx) e envie de novo.",
  );

export async function lerPlanilha(buffer) {
  if (!buffer?.length) throw new HttpError(400, "Envie um arquivo .xlsx com os apontamentos.");
  if (buffer.length > TAMANHO_MAXIMO)
    throw new HttpError(413, "O arquivo passa de 5 MB. Divida os apontamentos em mais arquivos.");
  // Todo .xlsx é um arquivo ZIP, que começa com "PK".
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw arquivoInvalido();
  const descompactado = tamanhoDescompactado(buffer);
  if (descompactado === null) throw arquivoInvalido();
  if (descompactado > TAMANHO_MAXIMO_DESCOMPACTADO)
    throw new HttpError(
      413,
      "O conteúdo da planilha é grande demais para importar de uma vez. Divida os apontamentos em mais arquivos.",
    );
  let pasta;
  try {
    pasta = await lerPasta(buffer);
  } catch {
    throw arquivoInvalido();
  }
  const aba =
    pasta.getWorksheet(ABA_APONTAMENTOS) ??
    pasta.worksheets.find((item) => !["Instruções", "Listas"].includes(item.name));
  if (!aba) throw new HttpError(400, `A planilha não tem a aba "${ABA_APONTAMENTOS}".`);

  const mapa = new Map();
  aba.getRow(1).eachCell((celula, numeroColuna) => {
    const texto = chaveCabecalho(valorDaCelula(celula.value));
    const coluna = COLUNAS.find((item) => item.apelidos.includes(texto));
    if (!coluna) return;
    if ([...mapa.values()].includes(coluna.chave))
      throw new HttpError(400, `A coluna "${coluna.titulo}" aparece duas vezes no cabeçalho.`);
    mapa.set(numeroColuna, coluna.chave);
  });
  const faltando = COLUNAS.filter(
    (coluna) => coluna.obrigatoria && ![...mapa.values()].includes(coluna.chave),
  );
  if (faltando.length)
    throw new HttpError(
      400,
      `Faltam colunas obrigatórias na linha 1 da aba "${aba.name}": ${faltando
        .map((coluna) => coluna.titulo)
        .join(", ")}. Baixe o modelo e mantenha o cabeçalho.`,
    );

  const linhas = [];
  aba.eachRow({ includeEmpty: false }, (linha, numero) => {
    if (numero === 1) return;
    const valores = {};
    for (const [numeroColuna, chave] of mapa)
      valores[chave] = valorDaCelula(linha.getCell(numeroColuna).value);
    if (Object.values(valores).every(vazio)) return;
    linhas.push({ linha: numero, valores });
  });
  if (!linhas.length)
    throw new HttpError(
      400,
      `Nenhum apontamento encontrado na aba "${aba.name}". Preencha a partir da linha 2.`,
    );
  if (linhas.length > LIMITE_LINHAS)
    throw new HttpError(
      400,
      `A planilha tem ${linhas.length} apontamentos e o limite é ${LIMITE_LINHAS.toLocaleString("pt-BR")} por importação. Divida em mais arquivos.`,
    );
  return { aba: aba.name, linhas };
}

// ---------------------------------------------------------------- campos de cada linha

const epocaExcel = Date.UTC(1899, 11, 30);

function lerData(valor, hoje) {
  if (vazio(valor)) return { erro: "Informe a data." };
  let dia = null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    dia = diaIso(valor);
  } else if (typeof valor === "number" && valor > 1 && valor < 2958466) {
    // Data digitada numa célula sem formato de data: número de série do Excel.
    dia = diaIso(new Date(epocaExcel + Math.floor(valor) * 86400000));
  } else {
    const texto = String(valor).trim();
    const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const partes = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
    if (partes) {
      const candidato = `${partes[0]}-${partes[1].padStart(2, "0")}-${partes[2].padStart(2, "0")}`;
      const data = dataUtc(candidato);
      if (!Number.isNaN(data.getTime()) && diaIso(data) === candidato) dia = candidato;
    }
  }
  if (!dia) return { erro: "Data inválida. Use o formato dd/mm/aaaa." };
  if (dia < DATA_MINIMA) return { erro: `Data inválida: ${dataBr(dia)} é anterior a 2000.` };
  if (dia > hoje) return { erro: `A data não pode ser depois de hoje (${dataBr(hoje)}).` };
  return { valor: dia };
}

function lerHoras(valor) {
  if (vazio(valor)) return { erro: "Informe as horas." };
  let horas = null;
  let deMinutos = false;
  if (typeof valor === "number") horas = valor;
  else if (valor instanceof Date) {
    // Célula com formato de hora (08:30): o Excel guarda uma fração do dia.
    horas = (valor.getTime() - epocaExcel) / 3600000;
    deMinutos = true;
  } else {
    const texto = String(valor).trim().replace(/\s*h$/i, "");
    const relogio = texto.match(/^(\d{1,2}):([0-5]\d)$/);
    if (relogio) {
      horas = Number(relogio[1]) + Number(relogio[2]) / 60;
      deMinutos = true;
    } else if (/^\d+([.,]\d+)?$/.test(texto)) horas = Number(texto.replace(",", "."));
  }
  if (horas === null || !Number.isFinite(horas))
    return { erro: "Horas inválidas. Use número (7,5) ou horas e minutos (07:30)." };
  if (deMinutos) horas = Math.round(horas * 100) / 100;
  if (Math.abs(horas * 100 - Math.round(horas * 100)) > 1e-7)
    return { erro: "Informe as horas com até duas casas decimais." };
  if (horas <= 0 || horas > LIMITE_HORAS_DIA)
    return { erro: `As horas devem ficar entre 0,01 e ${LIMITE_HORAS_DIA}.` };
  return { valor: horas };
}

function lerStatus(valor) {
  if (vazio(valor)) return { valor: "PENDENTE" };
  const status = STATUS[normalizarTexto(valor)];
  return status
    ? { valor: status }
    : { erro: "Status inválido. Use Pendente, Aprovado ou Faturado." };
}

function lerDescricao(valor) {
  const texto = String(valor ?? "").trim();
  if (texto.length < 3) return { erro: "Descreva a atividade (mínimo de 3 caracteres)." };
  if (texto.length > 1000) return { erro: "A descrição passa de 1.000 caracteres." };
  return { valor: texto };
}

// ---------------------------------------------------------------- referências a cadastros

function agrupar(lista, chave) {
  const mapa = new Map();
  for (const item of lista) {
    const valor = chave(item);
    mapa.set(valor, [...(mapa.get(valor) ?? []), item]);
  }
  return mapa;
}

/** Nome exibido no modelo: o próprio nome, ou "Nome [#id]" quando há nomes repetidos. */
export function referencias(lista, nome) {
  const repetidos = agrupar(lista, (item) => normalizarTexto(nome(item)));
  return new Map(
    lista.map((item) => [
      item.id,
      repetidos.get(normalizarTexto(nome(item))).length > 1
        ? `${nome(item)} [#${item.id}]`
        : nome(item),
    ]),
  );
}

function indexar({ colaboradores, projetos, tarefas }) {
  return {
    colaboradorPorEmail: new Map(colaboradores.map((item) => [normalizarTexto(item.email), item])),
    colaboradoresPorNome: agrupar(colaboradores, (item) => normalizarTexto(item.nomeCompleto)),
    projetoPorId: new Map(projetos.map((item) => [item.id, item])),
    projetosPorNome: agrupar(projetos, (item) => normalizarTexto(item.nome)),
    tarefaPorId: new Map(tarefas.map((item) => [item.id, item])),
    tarefasPorProjetoTitulo: agrupar(
      tarefas,
      (item) => `${item.projetoId}|${normalizarTexto(item.titulo)}`,
    ),
  };
}

function lerColaborador(valor, indice) {
  if (vazio(valor)) return { erro: "Informe o e-mail do colaborador." };
  const texto = normalizarTexto(valor);
  const porEmail = indice.colaboradorPorEmail.get(texto);
  if (porEmail) return { valor: porEmail };
  const porNome = indice.colaboradoresPorNome.get(texto) ?? [];
  if (porNome.length === 1) return { valor: porNome[0] };
  if (porNome.length > 1)
    return { erro: "Há mais de um colaborador com esse nome. Use o e-mail do colaborador." };
  return { erro: "Colaborador não encontrado. Use o e-mail cadastrado (aba Listas do modelo)." };
}

function lerProjeto(valor, indice) {
  if (vazio(valor)) return { erro: "Informe o projeto." };
  const texto = String(valor).trim();
  const codigo = texto.match(comCodigo);
  if (codigo) {
    const projeto = indice.projetoPorId.get(Number(codigo[1]));
    return projeto ? { valor: projeto } : { erro: `Projeto #${codigo[1]} não encontrado.` };
  }
  const encontrados = indice.projetosPorNome.get(normalizarTexto(texto)) ?? [];
  if (encontrados.length === 1) return { valor: encontrados[0] };
  if (encontrados.length > 1)
    return {
      erro: "Há mais de um projeto com esse nome. Use o nome com o código, como na aba Listas (ex.: Portal [#3]).",
    };
  return { erro: "Projeto não encontrado. Confira o nome na aba Listas do modelo." };
}

function lerTarefa(valor, projeto, indice) {
  if (vazio(valor)) return { valor: null };
  if (!projeto) return { valor: null };
  const texto = String(valor).trim();
  const codigo = texto.match(comCodigo);
  let tarefa;
  if (codigo) {
    tarefa = indice.tarefaPorId.get(Number(codigo[1]));
    if (!tarefa) return { erro: `Tarefa #${codigo[1]} não encontrada.` };
    if (tarefa.projetoId !== projeto.id)
      return { erro: `A tarefa #${tarefa.id} não pertence ao projeto ${projeto.nome}.` };
  } else {
    const encontradas =
      indice.tarefasPorProjetoTitulo.get(`${projeto.id}|${normalizarTexto(texto)}`) ?? [];
    if (encontradas.length > 1)
      return {
        erro: "Há mais de uma tarefa com esse título no projeto. Use o título com o código, como na aba Listas.",
      };
    if (!encontradas.length) return { erro: `Tarefa não encontrada no projeto ${projeto.nome}.` };
    tarefa = encontradas[0];
  }
  if (tarefa.statusRegistro !== "ATIVO" || tarefa.projeto?.status !== "ATIVO")
    return {
      erro: "A tarefa ou o projeto está inativo. Só é possível vincular horas a tarefas ativas.",
    };
  return { valor: tarefa };
}

// ---------------------------------------------------------------- validação

/** Confere cada linha sozinha: formato dos campos e cadastros existentes. */
export function interpretarLinhas(linhas, cadastros, hoje) {
  const indice = indexar(cadastros);
  return linhas.map(({ linha, valores }) => {
    const erros = [];
    const campo = (chave, resultado) => {
      if (resultado.erro)
        erros.push({ campo: chave, coluna: TITULO[chave], mensagem: resultado.erro });
      return resultado.valor ?? null;
    };
    const data = campo("data", lerData(valores.data, hoje));
    const colaborador = campo("colaborador", lerColaborador(valores.colaborador, indice));
    const projeto = campo("projeto", lerProjeto(valores.projeto, indice));
    if (colaborador && colaborador.status !== "ATIVO")
      erros.push({
        campo: "colaborador",
        mensagem: "Selecione um colaborador ativo para lançar horas.",
      });
    if (projeto && projeto.status !== "ATIVO")
      erros.push({ campo: "projeto", mensagem: "Selecione um projeto ativo para lançar horas." });
    const tarefa = campo("tarefa", lerTarefa(valores.tarefa, projeto, indice));
    const horas = campo("horas", lerHoras(valores.horas));
    const status = campo("status", lerStatus(valores.status));
    const descricao = campo("descricao", lerDescricao(valores.descricao));
    return { linha, data, colaborador, projeto, tarefa, horas, status, descricao, erros };
  });
}

const chaveIgualdade = ({ colaboradorId, projetoId, tarefaId, data, horas, descricao }) =>
  [
    colaboradorId,
    projetoId,
    tarefaId ?? "",
    data,
    centesimos(horas),
    normalizarTexto(descricao),
  ].join("|");

/**
 * Confere as linhas em conjunto e contra o que já está gravado: linhas repetidas,
 * importação repetida e o limite de 24 h por colaborador no dia.
 */
export function conferirConflitos(linhas, existentes) {
  const completas = linhas.filter(
    (item) => item.data && item.colaborador && item.projeto && item.horas && item.descricao,
  );
  const gravadas = new Set(
    existentes.map((item) =>
      chaveIgualdade({ ...item, data: financeDay(item.data), horas: Number(item.horas) }),
    ),
  );
  const primeiraLinha = new Map();
  for (const item of completas) {
    const chave = chaveIgualdade({
      colaboradorId: item.colaborador.id,
      projetoId: item.projeto.id,
      tarefaId: item.tarefa?.id,
      data: item.data,
      horas: item.horas,
      descricao: item.descricao,
    });
    if (gravadas.has(chave))
      item.erros.push({
        campo: "linha",
        coluna: "Linha inteira",
        mensagem:
          "Esse apontamento já existe no sistema. A planilha pode ter sido importada antes.",
      });
    else if (primeiraLinha.has(chave))
      item.erros.push({
        campo: "linha",
        coluna: "Linha inteira",
        mensagem: `Linha repetida: igual à linha ${primeiraLinha.get(chave)}.`,
      });
    else primeiraLinha.set(chave, item.linha);
  }

  const jaLancadas = new Map();
  for (const item of existentes) {
    const chave = `${item.colaboradorId}|${financeDay(item.data)}`;
    jaLancadas.set(chave, (jaLancadas.get(chave) ?? 0) + centesimos(item.horas));
  }
  const porDia = agrupar(completas, (item) => `${item.colaborador.id}|${item.data}`);
  for (const [chave, grupo] of porDia) {
    const antes = jaLancadas.get(chave) ?? 0;
    const naPlanilha = grupo.reduce((soma, item) => soma + centesimos(item.horas), 0);
    if (antes + naPlanilha <= LIMITE_HORAS_DIA * 100) continue;
    const mensagem = `${grupo[0].colaborador.nomeCompleto} ficaria com ${horasTexto((antes + naPlanilha) / 100)} em ${dataBr(grupo[0].data)}: ${horasTexto(antes / 100)} já lançadas + ${horasTexto(naPlanilha / 100)} nesta planilha. O limite é ${LIMITE_HORAS_DIA} h por dia.`;
    for (const item of grupo) item.erros.push({ campo: "horas", coluna: TITULO.horas, mensagem });
  }
  return linhas;
}

/**
 * Avisos que não impedem a importação, mas deixam o custo incompleto no dashboard:
 * colaborador fora da equipe do projeto na data ou sem valor/hora vigente.
 */
export function conferirCustos(linhas, { equipes = [], vigencias = [], colaboradores = [] }) {
  const naData = (inicio, fim, dia) =>
    financeDay(inicio) <= dia && (!fim || financeDay(fim) >= dia);
  for (const item of linhas) {
    item.avisos = [];
    if (!item.data || !item.colaborador || !item.projeto) continue;
    const operationalTeam = equipes.some(
      (member) =>
        member.projetoId === item.projeto.id &&
        naData(member.dataEntrada, member.dataSaida, item.data) &&
        colaboradores.some(
          (person) => person.id === member.colaboradorId && person.status === "ATIVO",
        ),
    );
    if (!operationalTeam)
      item.erros.push({
        campo: "projeto",
        coluna: "Projeto",
        mensagem:
          "Vincule ao menos um colaborador ativo à equipe do projeto na data das horas antes de lançar apontamentos.",
      });
    const naEquipe = equipes.some(
      (vinculo) =>
        vinculo.projetoId === item.projeto.id &&
        vinculo.colaboradorId === item.colaborador.id &&
        naData(vinculo.dataEntrada, vinculo.dataSaida, item.data),
    );
    if (!naEquipe)
      item.avisos.push(
        "O colaborador não está na equipe do projeto nessa data: o custo entra sem bonificação.",
      );
    const comValorHora = vigencias.some(
      (vigencia) =>
        vigencia.colaboradorId === item.colaborador.id &&
        naData(vigencia.dataInicio, vigencia.dataFim, item.data),
    );
    if (!comValorHora)
      item.avisos.push(
        "O colaborador não tem valor/hora vigente nessa data: as horas entram sem custo.",
      );
    if (item.status === "FATURADO" && (!naEquipe || !comValorHora))
      item.erros.push({
        campo: "status",
        coluna: "Status",
        mensagem:
          "Para importar como Faturado, é necessário valor/hora e participação na equipe na data das horas. Corrija os cadastros ou importe como Pendente/Aprovado.",
      });
  }
  return linhas;
}

function resumir(aba, linhas) {
  const validas = linhas.filter((item) => !item.erros.length);
  const dias = validas.map((item) => item.data).sort();
  const porStatus = { PENDENTE: 0, APROVADO: 0, FATURADO: 0 };
  for (const item of validas) porStatus[item.status]++;
  return {
    aba,
    resumo: {
      linhas: linhas.length,
      validas: validas.length,
      comErro: linhas.length - validas.length,
      comAviso: validas.filter((item) => item.avisos?.length).length,
      horas: validas.reduce((soma, item) => soma + centesimos(item.horas), 0) / 100,
      colaboradores: new Set(validas.map((item) => item.colaborador.id)).size,
      projetos: new Set(validas.map((item) => item.projeto.id)).size,
      periodo: dias.length ? { inicio: dias[0], fim: dias[dias.length - 1] } : null,
      porStatus,
    },
    linhas: linhas.map((item) => ({
      linha: item.linha,
      data: item.data,
      colaborador: item.colaborador
        ? {
            id: item.colaborador.id,
            nome: item.colaborador.nomeCompleto,
            email: item.colaborador.email,
          }
        : null,
      projeto: item.projeto ? { id: item.projeto.id, nome: item.projeto.nome } : null,
      tarefa: item.tarefa ? { id: item.tarefa.id, titulo: item.tarefa.titulo } : null,
      horas: item.horas,
      status: item.status,
      descricao: item.descricao,
      valida: !item.erros.length,
      erros: item.erros,
      avisos: item.avisos ?? [],
    })),
    erros: linhas.flatMap((item) => item.erros.map((erro) => ({ linha: item.linha, ...erro }))),
  };
}

async function analisar(planilha, cadastros, db) {
  const hoje = financeDay(todayFinanceDate());
  const linhas = interpretarLinhas(planilha.linhas, cadastros, hoje);
  const colaboradorIds = [
    ...new Set(linhas.filter((i) => i.colaborador).map((i) => i.colaborador.id)),
  ];
  const datas = [...new Set(linhas.filter((i) => i.data).map((i) => i.data))].map(dataUtc);
  const existentes = await repositorio.existentes(colaboradorIds, datas, db);
  conferirCustos(linhas, cadastros);
  return resumir(planilha.aba, conferirConflitos(linhas, existentes));
}

// ---------------------------------------------------------------- modelo para download

function abaInstrucoes(pasta) {
  const aba = pasta.addWorksheet("Instruções", { properties: { tabColor: { argb: "FF1F4E5F" } } });
  escreverTitulo(
    aba,
    "CODE BI — Importação de apontamentos de horas",
    "Preencha a aba Apontamentos (uma linha por apontamento) e envie o arquivo em Importar horas.",
  );
  const passos = [
    "1. Preencha a aba Apontamentos a partir da linha 2. Não mude o cabeçalho da linha 1.",
    "2. Use o e-mail do colaborador e o nome do projeto exatamente como aparecem na aba Listas.",
    "3. No sistema, clique em Validar arquivo: os erros aparecem por linha, sem gravar nada.",
    "4. Corrija o que for apontado e envie de novo. Com tudo certo, clique em Importar.",
    "A importação é tudo ou nada: se uma linha tiver erro, nenhuma é gravada.",
  ];
  passos.forEach((texto, indice) => (aba.getCell(`A${4 + indice}`).value = texto));

  const cabecalho = aba.getRow(10);
  cabecalho.values = ["Coluna", "Obrigatória", "Como preencher"];
  estilizarCabecalho(cabecalho, 3);
  const regras = [
    ["Data", "Sim", "Dia trabalhado, no formato dd/mm/aaaa. Não pode ser depois de hoje."],
    ["E-mail do colaborador", "Sim", "E-mail cadastrado do colaborador (aba Listas)."],
    [
      "Projeto",
      "Sim",
      "Nome do projeto como na aba Listas. Nomes repetidos levam o código: Nome [#12].",
    ],
    [
      "Tarefa (opcional)",
      "Não",
      "Título de uma tarefa ativa do mesmo projeto. Em branco, o apontamento fica sem tarefa.",
    ],
    [
      "Horas",
      "Sim",
      "Número com até duas casas (7,5) ou horas e minutos (07:30). Máximo de 24 h por colaborador no dia, somando o que já está no sistema.",
    ],
    ["Status (opcional)", "Não", "Pendente, Aprovado ou Faturado. Em branco, entra como Pendente."],
    ["Descrição", "Sim", "O que foi feito, com pelo menos 3 caracteres."],
  ];
  regras.forEach((valores, indice) => {
    const linha = aba.getRow(11 + indice);
    linha.values = valores;
    linha.alignment = { vertical: "top", wrapText: true };
  });
  aba.getCell("A19").value =
    `Limite: ${LIMITE_LINHAS.toLocaleString("pt-BR")} apontamentos e 5 MB por arquivo. Linhas iguais a apontamentos já gravados são recusadas, para evitar importação repetida.`;
  aba.getCell("A19").font = { italic: true, color: { argb: "FF555555" } };
  aba.getColumn(1).width = 26;
  aba.getColumn(2).width = 13;
  aba.getColumn(3).width = 90;
}

function prepararListas(cadastros) {
  const nomesProjetos = referencias(cadastros.projetos, (item) => item.nome);
  const tarefas = cadastros.tarefas.filter(
    (item) => item.statusRegistro === "ATIVO" && item.projeto?.status === "ATIVO",
  );
  const titulos = new Map();
  for (const grupo of agrupar(tarefas, (item) => item.projetoId).values())
    for (const [id, titulo] of referencias(grupo, (item) => item.titulo)) titulos.set(id, titulo);
  return {
    colaboradores: cadastros.colaboradores.filter((item) => item.status === "ATIVO"),
    projetos: cadastros.projetos
      .filter((item) => item.status === "ATIVO")
      .map((item) => ({ nome: nomesProjetos.get(item.id), cliente: item.cliente?.nome ?? null })),
    tarefas: tarefas.map((item) => ({
      titulo: titulos.get(item.id),
      projeto: nomesProjetos.get(item.projetoId),
    })),
  };
}

function abaListas(pasta, listas) {
  const aba = pasta.addWorksheet("Listas");
  const cabecalho = aba.getRow(1);
  cabecalho.values = [
    "E-mail do colaborador",
    "Colaborador",
    "",
    "Projeto",
    "Cliente",
    "",
    "Tarefa",
    "Projeto da tarefa",
  ];
  estilizarCabecalho(cabecalho, 8);
  listas.colaboradores.forEach((item, indice) => {
    const linha = aba.getRow(indice + 2);
    linha.getCell(1).value = item.email;
    linha.getCell(2).value = item.nomeCompleto;
  });
  listas.projetos.forEach((item, indice) => {
    const linha = aba.getRow(indice + 2);
    linha.getCell(4).value = item.nome;
    linha.getCell(5).value = item.cliente;
  });
  listas.tarefas.forEach((item, indice) => {
    const linha = aba.getRow(indice + 2);
    linha.getCell(7).value = item.titulo;
    linha.getCell(8).value = item.projeto;
  });
  [32, 30, 3, 36, 28, 3, 40, 36].forEach((largura, indice) => {
    aba.getColumn(indice + 1).width = largura;
  });
  aba.views = [{ state: "frozen", ySplit: 1 }];
}

function abaApontamentos(pasta, listas) {
  const aba = pasta.addWorksheet(ABA_APONTAMENTOS);
  const cabecalho = aba.getRow(1);
  cabecalho.values = COLUNAS.map((coluna) => coluna.titulo);
  estilizarCabecalho(cabecalho, COLUNAS.length);
  [13, 32, 34, 30, 9, 16, 50].forEach((largura, indice) => {
    aba.getColumn(indice + 1).width = largura;
  });
  aba.views = [{ state: "frozen", ySplit: 1 }];
  const ultima = LIMITE_LINHAS + 1;
  const intervalo = (coluna) => `${coluna}2:${coluna}${ultima}`;
  const aviso = (titulo, mensagem) => ({
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: titulo,
    error: mensagem,
  });
  aba.getColumn(1).numFmt = FORMATOS.data;
  aba.getColumn(5).numFmt = "0.00";
  aba.dataValidations.add(intervalo("A"), {
    type: "date",
    operator: "greaterThan",
    allowBlank: true,
    formulae: [dataUtc(DATA_MINIMA)],
    ...aviso("Data", "Informe a data no formato dd/mm/aaaa."),
  });
  if (listas.colaboradores.length)
    aba.dataValidations.add(intervalo("B"), {
      type: "list",
      allowBlank: true,
      formulae: [`Listas!$A$2:$A$${listas.colaboradores.length + 1}`],
      ...aviso("Colaborador", "Use um e-mail da aba Listas."),
    });
  if (listas.projetos.length)
    aba.dataValidations.add(intervalo("C"), {
      type: "list",
      allowBlank: true,
      formulae: [`Listas!$D$2:$D$${listas.projetos.length + 1}`],
      ...aviso("Projeto", "Use um projeto da aba Listas."),
    });
  aba.dataValidations.add(intervalo("E"), {
    type: "decimal",
    operator: "between",
    allowBlank: true,
    formulae: [0.01, LIMITE_HORAS_DIA],
    ...aviso("Horas", `Informe de 0,01 a ${LIMITE_HORAS_DIA} horas.`),
  });
  aba.dataValidations.add(intervalo("F"), {
    type: "list",
    allowBlank: true,
    formulae: ['"Pendente,Aprovado,Faturado"'],
    ...aviso("Status", "Use Pendente, Aprovado ou Faturado."),
  });
}

export async function montarModelo(cadastros) {
  const pasta = novaPasta();
  const listas = prepararListas(cadastros);
  abaInstrucoes(pasta);
  abaApontamentos(pasta, listas);
  abaListas(pasta, listas);
  return paraBuffer(pasta);
}

// ---------------------------------------------------------------- casos de uso

export const importacaoApontamentosService = {
  async modelo() {
    const arquivo = await montarModelo(await repositorio.cadastros());
    return { arquivo, nome: "modelo-importacao-apontamentos.xlsx" };
  },

  /** Lê e confere a planilha sem gravar nada. */
  async validar(buffer) {
    const planilha = await lerPlanilha(buffer);
    return analisar(planilha, await repositorio.cadastros());
  },

  /**
   * Grava todos os apontamentos ou nenhum. A conferência é refeita dentro de uma
   * transação serializável, como no cadastro manual, para que gravações simultâneas
   * não passem do limite de horas do dia.
   */
  async importar(buffer) {
    const planilha = await lerPlanilha(buffer);
    return apontamentosRepository.transaction(async (db) => {
      const cadastros = await repositorio.cadastros(db);
      const resultado = await analisar(planilha, cadastros, db);
      if (resultado.resumo.comErro)
        throw new HttpError(
          422,
          `Nenhum apontamento foi importado: ${resultado.resumo.comErro} ${resultado.resumo.comErro === 1 ? "linha tem" : "linhas têm"} erro.`,
          resultado,
        );
      await repositorio.criar(
        resultado.linhas.map((item) => ({
          colaboradorId: item.colaborador.id,
          projetoId: item.projeto.id,
          tarefaId: item.tarefa?.id ?? null,
          data: dataUtc(item.data),
          horas: item.horas,
          status: item.status,
          descricao: item.descricao,
        })),
        db,
      );
      return { importados: resultado.resumo.validas, ...resultado.resumo };
    });
  },
};
