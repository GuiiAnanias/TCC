import { apontamentosRepository } from "../repositories/apontamentosRepository.js";
import { importacaoApontamentosRepository as repositorio } from "../repositories/importacaoApontamentosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { financeDay, todayFinanceDate } from "../utils/financeDates.js";
import {
  FORMATOS,
  dataBr,
  dataUtc,
  diaIso,
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
    pasta.worksheets.find((item) => !ABAS_DE_APOIO.includes(item.name));
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

export const ABA_COMO_USAR = "Como usar";
const ABA_LISTAS = "Listas";
// Abas que nunca têm apontamentos ("Instruções" é a do modelo antigo).
const ABAS_DE_APOIO = [ABA_COMO_USAR, "Instruções", ABA_LISTAS];

// Cores do CODE BI (as mesmas variáveis do front, em ARGB).
const COR = {
  marca: "FF007F73",
  marcaEscura: "FF00675D",
  marcaTexto: "FF004C46",
  marcaClara: "FFE6F4F1",
  marcaLinha: "FFB9DAD4",
  texto: "FF202733",
  cinza: "FF667085",
  linha: "FFD8DEE4",
  fundo: "FFF5F7F8",
  branco: "FFFFFFFF",
  erro: "FFBD2B39",
  erroClaro: "FFFFF0F1",
  ok: "FF1F7A4D",
  okClaro: "FFEDF8F1",
  aba: "FF98A2B3",
};
const FONTE = "Calibri";
// Títulos do modelo com uma dica entre parênteses; a leitura ignora o que está entre parênteses.
const CABECALHO_MODELO = { data: "Data (dd/mm/aaaa)", horas: "Horas (ex.: 7,5)" };
export const CABECALHOS_MODELO = COLUNAS.map(
  (coluna) => CABECALHO_MODELO[coluna.chave] ?? coluna.titulo,
);
const LARGURAS = [14, 32, 32, 32, 13, 15, 56];
const LETRAS = ["A", "B", "C", "D", "E", "F", "G"];
const ULTIMA_LINHA = LIMITE_LINHAS + 1;

const solido = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fonte = (extra = {}) => ({ name: FONTE, size: 11, color: { argb: COR.texto }, ...extra });
const traco = (argb, style = "thin") => ({ style, color: { argb } });

/** Texto com trechos em **negrito**, no estilo do resto da célula. */
function rico(texto, base) {
  return {
    richText: texto
      .split(/(\*\*[^*]+\*\*)/)
      .filter(Boolean)
      .map((parte) =>
        parte.startsWith("**")
          ? { text: parte.slice(2, -2), font: { ...base, bold: true } }
          : { text: parte, font: base },
      ),
  };
}

function estiloTitulo(celula, obrigatoria) {
  celula.font = fonte({ bold: true, color: { argb: obrigatoria ? COR.branco : COR.marcaTexto } });
  celula.fill = solido(obrigatoria ? COR.marca : COR.marcaLinha);
  celula.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  celula.border = { bottom: traco(COR.marcaEscura, "medium"), right: traco(COR.branco) };
}

function faixa(aba, linha, texto, estilo, altura) {
  aba.mergeCells(`B${linha}:H${linha}`);
  const celula = aba.getCell(`B${linha}`);
  Object.assign(celula, { value: texto, ...estilo });
  if (altura) aba.getRow(linha).height = altura;
  return celula;
}

function secao(aba, linha, texto) {
  faixa(
    aba,
    linha,
    texto,
    {
      font: fonte({ bold: true, size: 13, color: { argb: COR.marcaTexto } }),
      alignment: { vertical: "bottom" },
      border: { bottom: traco(COR.marca, "medium") },
    },
    24,
  );
}

/** Linha numerada ou com marcador: o selo na coluna B e o texto de C a H. */
function item(aba, linha, selo, texto, { seloCheio = true } = {}) {
  const marcador = aba.getCell(`B${linha}`);
  marcador.value = selo;
  marcador.font = fonte({
    bold: true,
    size: seloCheio ? 14 : 13,
    color: { argb: seloCheio ? COR.branco : COR.marca },
  });
  marcador.fill = solido(seloCheio ? COR.marca : COR.marcaClara);
  marcador.alignment = { vertical: "middle", horizontal: "center" };
  marcador.border = { bottom: traco(COR.branco, "medium") };
  aba.mergeCells(`C${linha}:H${linha}`);
  const celula = aba.getCell(`C${linha}`);
  celula.value = rico(texto, fonte());
  celula.fill = solido(COR.fundo);
  celula.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  celula.border = { bottom: traco(COR.branco, "medium") };
  aba.getRow(linha).height = 33;
}

function abaComoUsar(pasta, hoje) {
  const aba = pasta.addWorksheet(ABA_COMO_USAR, {
    properties: { tabColor: { argb: COR.marca } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [2, 15, 30, 28, 28, 14, 14, 44].forEach((largura, indice) => {
    aba.getColumn(indice + 1).width = largura;
  });
  aba.getRow(1).height = 10;

  faixa(
    aba,
    2,
    "CODE BI  ·  Importar horas pelo Excel",
    {
      font: fonte({ bold: true, size: 20, color: { argb: COR.branco } }),
      fill: solido(COR.marca),
      alignment: { vertical: "middle", indent: 1 },
    },
    42,
  );
  faixa(
    aba,
    3,
    "Lance as horas de várias pessoas e projetos de uma vez, sem digitar uma por uma no sistema.",
    {
      font: fonte({ color: { argb: COR.marcaTexto } }),
      fill: solido(COR.marcaClara),
      alignment: { vertical: "middle", indent: 1 },
    },
    24,
  );

  secao(aba, 5, "Como fazer, em 4 passos");
  [
    "Preencha a aba **Apontamentos** a partir da linha 2: uma linha por pessoa, dia e projeto.",
    "Clique na **setinha** de cada célula para escolher e-mail, projeto, tarefa e status. As opções vêm do sistema.",
    "No CODE BI, abra **Importar horas** e escolha este arquivo. Nada é gravado antes de você conferir.",
    "Viu algum erro? Corrija a linha indicada e envie de novo. Tudo certo? Clique em **Importar**.",
  ].forEach((texto, indice) => item(aba, 6 + indice, indice + 1, texto));

  secao(aba, 11, "Exemplo de linha preenchida");
  const titulos = aba.getRow(12);
  const exemplo = aba.getRow(13);
  const valores = [
    dataUtc(hoje),
    "maria.souza@empresa.com",
    "Portal do Cliente",
    "Tela de login",
    7.5,
    "Aprovado",
    "Ajustes no layout da tela de login",
  ];
  COLUNAS.forEach((coluna, indice) => {
    const titulo = titulos.getCell(indice + 2);
    titulo.value = CABECALHOS_MODELO[indice];
    estiloTitulo(titulo, coluna.obrigatoria);
    const celula = exemplo.getCell(indice + 2);
    celula.value = valores[indice];
    celula.font = fonte({ italic: true, color: { argb: COR.cinza } });
    celula.alignment = {
      vertical: "middle",
      horizontal: indice === 4 ? "center" : "left",
      wrapText: true,
    };
    celula.border = { bottom: traco(COR.linha), right: traco(COR.linha), left: traco(COR.linha) };
  });
  exemplo.getCell(2).numFmt = FORMATOS.data;
  titulos.height = 34;
  exemplo.height = 22;
  faixa(
    aba,
    14,
    rico(
      "Título **verde-escuro** = obrigatório. Título **verde-claro** = opcional (Status em branco entra como Pendente).",
      fonte({ size: 10, color: { argb: COR.cinza } }),
    ),
    {
      alignment: { vertical: "top", wrapText: true },
    },
    20,
  );

  secao(aba, 16, "Bom saber");
  [
    "**Horas** em número, com até duas casas: 7,5 = sete horas e meia. No máximo 24 h por pessoa no dia, somando o que já está no sistema.",
    "**Célula vermelha** na aba Apontamentos = falta preencher ou o valor não é aceito. O resumo ao lado da tabela conta as linhas incompletas.",
    "**Tudo ou nada:** se uma linha tiver erro, nenhuma é gravada. Linha igual a um apontamento já gravado é recusada.",
    `**Limite:** ${LIMITE_LINHAS.toLocaleString("pt-BR")} linhas e 5 MB por arquivo. Não mude os títulos da linha 1 da aba Apontamentos.`,
  ].forEach((texto, indice) => item(aba, 17 + indice, "✓", texto, { seloCheio: false }));

  faixa(
    aba,
    22,
    `Modelo gerado pelo CODE BI em ${dataBr(hoje)}. As listas trazem os cadastros ativos nesse dia: se algo mudar, baixe o modelo de novo.`,
    {
      font: fonte({ size: 9, italic: true, color: { argb: COR.cinza } }),
      alignment: { vertical: "bottom", wrapText: true },
    },
    28,
  );
}

function prepararListas(cadastros) {
  const nomesProjetos = referencias(cadastros.projetos, (item) => item.nome);
  const projetos = cadastros.projetos.filter((item) => item.status === "ATIVO");
  const ordemProjeto = new Map(projetos.map((item, indice) => [item.id, indice]));
  const tarefas = cadastros.tarefas.filter(
    (item) => item.statusRegistro === "ATIVO" && item.projeto?.status === "ATIVO",
  );
  const titulos = new Map();
  for (const grupo of agrupar(tarefas, (item) => item.projetoId).values())
    for (const [id, titulo] of referencias(grupo, (item) => item.titulo)) titulos.set(id, titulo);
  return {
    colaboradores: cadastros.colaboradores.filter((item) => item.status === "ATIVO"),
    projetos: projetos.map((item) => ({
      nome: nomesProjetos.get(item.id),
      cliente: item.cliente?.nome ?? null,
    })),
    // Agrupadas por projeto: a lista de tarefas da aba Apontamentos mostra só o bloco do
    // projeto escolhido na linha.
    tarefas: tarefas
      .map((item) => ({
        titulo: titulos.get(item.id),
        projeto: nomesProjetos.get(item.projetoId),
        ordem: ordemProjeto.get(item.projetoId) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"))
      .map(({ titulo, projeto }) => ({ titulo, projeto })),
  };
}

// Nomes definidos: as setinhas e as cores da aba Apontamentos apontam para cá.
const NOMES = {
  emails: "ListaEmails",
  colaboradores: "ListaColaboradores",
  projetos: "ListaProjetos",
  tarefas: "ListaTarefas",
  projetoDaTarefa: "ListaProjetoDaTarefa",
};

async function abaListas(pasta, listas) {
  const aba = pasta.addWorksheet(ABA_LISTAS, {
    properties: { tabColor: { argb: COR.aba } },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const colunas = [
    {
      titulo: "E-mail do colaborador",
      largura: 32,
      itens: listas.colaboradores,
      campo: "email",
      nome: NOMES.emails,
    },
    {
      titulo: "Colaborador",
      largura: 30,
      itens: listas.colaboradores,
      campo: "nomeCompleto",
      nome: NOMES.colaboradores,
    },
    null,
    { titulo: "Projeto", largura: 36, itens: listas.projetos, campo: "nome", nome: NOMES.projetos },
    { titulo: "Cliente", largura: 30, itens: listas.projetos, campo: "cliente" },
    null,
    { titulo: "Tarefa", largura: 40, itens: listas.tarefas, campo: "titulo", nome: NOMES.tarefas },
    {
      titulo: "Projeto da tarefa",
      largura: 36,
      itens: listas.tarefas,
      campo: "projeto",
      nome: NOMES.projetoDaTarefa,
    },
  ];
  aba.getRow(1).height = 30;
  colunas.forEach((coluna, indice) => {
    const numero = indice + 1;
    aba.getColumn(numero).width = coluna?.largura ?? 3;
    if (!coluna) return;
    const titulo = aba.getCell(1, numero);
    titulo.value = coluna.titulo;
    titulo.font = fonte({ bold: true, color: { argb: COR.marcaTexto } });
    titulo.fill = solido(COR.marcaClara);
    titulo.alignment = { vertical: "middle", indent: 1 };
    titulo.border = { bottom: traco(COR.marca, "medium") };
    coluna.itens.forEach((registro, posicao) => {
      const celula = aba.getCell(posicao + 2, numero);
      celula.value = registro[coluna.campo];
      celula.font = fonte();
      celula.alignment = { indent: 1 };
      celula.border = { bottom: traco(COR.linha) };
    });
    if (coluna.nome && coluna.itens.length) {
      const letra = aba.getColumn(numero).letter;
      pasta.definedNames.add(
        `${ABA_LISTAS}!$${letra}$2:$${letra}$${coluna.itens.length + 1}`,
        coluna.nome,
      );
    }
  });
  aba.getColumn(10).width = 48;
  const aviso = aba.getCell("J1");
  aviso.value = "Só para consulta";
  aviso.font = fonte({ bold: true, color: { argb: COR.marcaTexto } });
  aviso.alignment = { vertical: "middle", indent: 1 };
  aba.mergeCells("J2:J4");
  const explicacao = aba.getCell("J2");
  explicacao.value =
    "As setinhas da aba Apontamentos usam estas listas. Para incluir alguém, um projeto ou uma tarefa, cadastre no CODE BI e baixe o modelo de novo.";
  explicacao.font = fonte({ size: 10, color: { argb: COR.cinza } });
  explicacao.alignment = { vertical: "top", wrapText: true, indent: 1 };
  // Protegida sem senha: evita apagar uma lista sem querer; quem precisar pode desproteger.
  await aba.protect("", { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true });
}

/** Regras de cor que o próprio Excel aplica enquanto a pessoa preenche. */
function coresDeConferencia(aba, listas) {
  const iniciada = "COUNTA($A2:$G2)>0";
  const faltando = (letra) => `AND(${iniciada},${letra}2="")`;
  const regras = {
    A: `OR(${faltando("A")},AND(A2<>"",OR(NOT(ISNUMBER(A2)),A2>TODAY(),A2<DATE(2000,1,1))))`,
    B: listas.colaboradores.length
      ? `OR(${faltando("B")},AND(B2<>"",COUNTIF(${NOMES.emails},B2)+COUNTIF(${NOMES.colaboradores},B2)=0))`
      : faltando("B"),
    C: listas.projetos.length
      ? `OR(${faltando("C")},AND(C2<>"",COUNTIF(${NOMES.projetos},C2)=0))`
      : faltando("C"),
    D: listas.tarefas.length
      ? `AND(D2<>"",COUNTIFS(${NOMES.tarefas},D2,${NOMES.projetoDaTarefa},C2)=0)`
      : `D2<>""`,
    E: `OR(${faltando("E")},AND(ISNUMBER(E2),OR(E2<=0,E2>${LIMITE_HORAS_DIA})))`,
    F: `AND(F2<>"",NOT(OR(F2="Pendente",F2="Aprovado",F2="Faturado")))`,
    G: `OR(${faltando("G")},AND(G2<>"",LEN(TRIM(G2))<3))`,
  };
  const vermelho = {
    fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.erroClaro } },
    font: { color: { argb: COR.erro }, bold: true },
  };
  Object.entries(regras).forEach(([letra, formula], indice) => {
    aba.addConditionalFormatting({
      ref: `${letra}2:${letra}${ULTIMA_LINHA}`,
      rules: [{ type: "expression", priority: indice + 1, formulae: [formula], style: vermelho }],
    });
  });
  // Listras para facilitar a leitura (prioridade menor que o vermelho).
  aba.addConditionalFormatting({
    ref: `A2:G${ULTIMA_LINHA}`,
    rules: [
      {
        type: "expression",
        priority: 20,
        formulae: ["MOD(ROW(),2)=0"],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.fundo } } },
      },
    ],
  });
}

function validacoes(aba, listas) {
  const regra = (titulo, erro, dica) => ({
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: titulo,
    error: erro,
    showInputMessage: true,
    promptTitle: titulo,
    prompt: dica,
  });
  const intervalo = (letra) => `${letra}2:${letra}${ULTIMA_LINHA}`;
  aba.dataValidations.add(intervalo("A"), {
    type: "date",
    operator: "greaterThan",
    formulae: [dataUtc(DATA_MINIMA)],
    ...regra(
      "Data",
      "Informe a data no formato dd/mm/aaaa.",
      "Dia trabalhado, como 15/10/2026. Não pode ser depois de hoje.",
    ),
  });
  if (listas.colaboradores.length)
    aba.dataValidations.add(intervalo("B"), {
      type: "list",
      formulae: [NOMES.emails],
      ...regra(
        "Colaborador",
        "Use um e-mail da aba Listas.",
        "Clique na setinha e escolha o e-mail de quem trabalhou.",
      ),
    });
  if (listas.projetos.length)
    aba.dataValidations.add(intervalo("C"), {
      type: "list",
      formulae: [NOMES.projetos],
      ...regra(
        "Projeto",
        "Use um projeto da aba Listas.",
        "Clique na setinha e escolha o projeto.",
      ),
    });
  if (listas.tarefas.length)
    aba.dataValidations.add(intervalo("D"), {
      type: "list",
      // Só as tarefas do projeto da linha: o bloco dele na lista (agrupada por projeto).
      formulae: [
        `OFFSET(INDEX(${NOMES.tarefas},1),MATCH($C2,${NOMES.projetoDaTarefa},0)-1,0,COUNTIF(${NOMES.projetoDaTarefa},$C2),1)`,
      ],
      ...regra(
        "Tarefa (opcional)",
        "Use uma tarefa do projeto escolhido (aba Listas).",
        "Opcional. Escolha o projeto antes: a setinha mostra só as tarefas dele.",
      ),
    });
  aba.dataValidations.add(intervalo("E"), {
    type: "decimal",
    operator: "between",
    formulae: [0.01, LIMITE_HORAS_DIA],
    ...regra(
      "Horas",
      `Informe de 0,01 a ${LIMITE_HORAS_DIA} horas.`,
      "Horas trabalhadas no dia. Ex.: 7,5 = sete horas e meia.",
    ),
  });
  aba.dataValidations.add(intervalo("F"), {
    type: "list",
    formulae: ['"Pendente,Aprovado,Faturado"'],
    ...regra(
      "Status (opcional)",
      "Use Pendente, Aprovado ou Faturado.",
      "Opcional. Em branco, entra como Pendente.",
    ),
  });
  aba.dataValidations.add(intervalo("G"), {
    type: "textLength",
    operator: "between",
    formulae: [3, 1000],
    ...regra(
      "Descrição",
      "Descreva a atividade com 3 a 1.000 caracteres.",
      "O que foi feito, em poucas palavras.",
    ),
  });
}

/** Resumo ao lado da tabela, calculado pelo Excel. A leitura usa só as colunas A a G. */
function resumoLateral(aba) {
  const faixaDe = (letra) => `${letra}2:${letra}${ULTIMA_LINHA}`;
  const preenchida = `LEN(${LETRAS.map(faixaDe).join("&")})>0`;
  const incompleta = `((${["A", "B", "C", "E", "G"].map((letra) => `(${faixaDe(letra)}="")`).join("+")})>0)`;
  aba.getColumn(8).width = 3;
  aba.getColumn(9).width = 24;
  aba.getColumn(10).width = 14;
  aba.mergeCells("I1:J1");
  const titulo = aba.getCell("I1");
  titulo.value = "Resumo da planilha";
  titulo.font = fonte({ bold: true, color: { argb: COR.branco } });
  titulo.fill = solido(COR.marcaEscura);
  titulo.alignment = { vertical: "middle", horizontal: "center" };
  const linhas = [
    ["Linhas preenchidas", `SUMPRODUCT(--(${preenchida}))`, FORMATOS.inteiro],
    ["Total de horas", `SUM(${faixaDe("E")})`, "0.##"],
    ["Primeiro dia", `IF(COUNT(${faixaDe("A")})=0,"-",MIN(${faixaDe("A")}))`, FORMATOS.data],
    ["Último dia", `IF(COUNT(${faixaDe("A")})=0,"-",MAX(${faixaDe("A")}))`, FORMATOS.data],
    ["Linhas incompletas", `SUMPRODUCT((${preenchida})*${incompleta})`, FORMATOS.inteiro],
  ];
  linhas.forEach(([rotulo, formula, formato], indice) => {
    const linha = aba.getRow(indice + 2);
    const nome = linha.getCell(9);
    nome.value = rotulo;
    nome.font = fonte({ color: { argb: COR.cinza } });
    nome.fill = solido(COR.marcaClara);
    nome.alignment = { vertical: "middle", indent: 1 };
    const valor = linha.getCell(10);
    valor.value = { formula };
    valor.numFmt = formato;
    valor.font = fonte({ bold: true, color: { argb: COR.marcaTexto } });
    valor.fill = solido(COR.marcaClara);
    valor.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    for (const celula of [nome, valor]) celula.border = { bottom: traco(COR.branco) };
  });
  aba.addConditionalFormatting({
    ref: "J6",
    rules: [
      {
        type: "expression",
        priority: 30,
        formulae: ["$J$6>0"],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.erroClaro } },
          font: { color: { argb: COR.erro } },
        },
      },
      {
        type: "expression",
        priority: 31,
        formulae: ["AND($J$2>0,$J$6=0)"],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.okClaro } },
          font: { color: { argb: COR.ok } },
        },
      },
    ],
  });
  aba.mergeCells("I8:J11");
  const nota = aba.getCell("I8");
  nota.value = rico(
    "**Célula vermelha** = falta preencher ou o valor não é aceito. O CODE BI confere tudo de novo antes de gravar.",
    fonte({ size: 10, color: { argb: COR.cinza } }),
  );
  nota.alignment = { vertical: "top", wrapText: true };
}

function abaApontamentos(pasta, listas) {
  const aba = pasta.addWorksheet(ABA_APONTAMENTOS, {
    properties: { tabColor: { argb: COR.marcaEscura }, defaultRowHeight: 20 },
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  LARGURAS.forEach((largura, indice) => {
    aba.getColumn(indice + 1).width = largura;
  });
  aba.getColumn(1).numFmt = FORMATOS.data;
  // Horas sem formato fixo: 7,5 aparece como digitado e 07:30 vira hora no Excel.
  aba.getColumn(5).alignment = { horizontal: "center" };
  const cabecalho = aba.getRow(1);
  cabecalho.height = 36;
  COLUNAS.forEach((coluna, indice) => {
    const celula = cabecalho.getCell(indice + 1);
    celula.value = CABECALHOS_MODELO[indice];
    estiloTitulo(celula, coluna.obrigatoria);
  });
  aba.autoFilter = "A1:G1";
  validacoes(aba, listas);
  coresDeConferencia(aba, listas);
  resumoLateral(aba);
}

export async function montarModelo(cadastros, { hoje = financeDay(todayFinanceDate()) } = {}) {
  const pasta = novaPasta();
  pasta.title = "CODE BI — Modelo de importação de horas";
  // Sem valores guardados nas fórmulas: o Excel calcula o resumo ao abrir.
  pasta.calcProperties.fullCalcOnLoad = true;
  const listas = prepararListas(cadastros);
  abaComoUsar(pasta, hoje);
  abaApontamentos(pasta, listas);
  await abaListas(pasta, listas);
  pasta.views = [{ activeTab: 0, firstSheet: 0, visibility: "visible" }];
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
  async importar(buffer, { usuarioId, arquivo } = {}) {
    // Sem usuário (chamadas internas e testes antigos) não há a quem atribuir o histórico.
    const historico = usuarioId ? { usuarioId, arquivo: nomeDoArquivo(arquivo) } : null;
    try {
      return await gravarImportacao(buffer, historico);
    } catch (error) {
      if (historico) await registrarFalha(historico, error);
      throw error;
    }
  },

  async historico(filtros) {
    const { total, itens } = await repositorio.historico(filtros);
    return {
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
      total,
      paginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
      itens: itens.map(itemDoHistorico),
    };
  },
};

// ---------------------------------------------------------------- histórico

export const STATUS_IMPORTACAO = { CONCLUIDA: "CONCLUIDA", FALHOU: "FALHOU" };
const LIMITE_ERROS_HISTORICO = 20;
const FALHA_INESPERADA = "Erro inesperado ao importar. Nenhum apontamento foi gravado.";

// O nome vem do navegador (cabeçalho X-Nome-Arquivo, codificado para aceitar acentos).
function decodificar(valor) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

export function nomeDoArquivo(valor) {
  const nome = decodificar(String(valor ?? ""))
    .replace(/[\p{Cc}]/gu, "")
    .split(/[\\/]/)
    .pop()
    .trim();
  return nome.slice(0, 255) || "planilha.xlsx";
}

// Projetos reconhecidos nas linhas da planilha, sem repetição, em ordem alfabética.
function projetosDasLinhas(linhas = []) {
  const porId = new Map();
  for (const item of linhas) if (item.projeto) porId.set(item.projeto.id, item.projeto);
  return [...porId.values()]
    .map(({ id, nome }) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function dadosDoResumo(resultado) {
  const resumo = resultado?.resumo;
  return {
    linhas: resumo?.linhas ?? 0,
    comErro: resumo?.comErro ?? 0,
    horas: resumo?.horas ?? 0,
    periodoInicio: resumo?.periodo ? dataUtc(resumo.periodo.inicio) : null,
    periodoFim: resumo?.periodo ? dataUtc(resumo.periodo.fim) : null,
    projetos: projetosDasLinhas(resultado?.linhas),
    erros: (resultado?.erros ?? [])
      .slice(0, LIMITE_ERROS_HISTORICO)
      .map(({ linha, coluna, mensagem }) => ({ linha, coluna, mensagem })),
  };
}

// A falha é gravada depois do rollback. Se nem isso for possível, a importação
// continua respondendo o erro original; o problema do histórico fica no log.
async function registrarFalha(historico, error) {
  const conhecida = error instanceof HttpError && error.statusCode < 500;
  try {
    await repositorio.registrar({
      ...historico,
      ...dadosDoResumo(conhecida ? error.details : null),
      status: STATUS_IMPORTACAO.FALHOU,
      mensagem: conhecida ? error.message : FALHA_INESPERADA,
      importados: 0,
    });
  } catch (registroError) {
    console.error("Falha ao registrar a importação no histórico:", registroError.message);
  }
}

function itemDoHistorico(registro) {
  const dia = (valor) => (valor ? diaIso(valor) : null);
  return {
    id: registro.id,
    criadoEm: registro.createdAt,
    usuario: registro.usuario
      ? { id: registro.usuario.id, nome: registro.usuario.nomeUsuario }
      : null,
    arquivo: registro.arquivo,
    status: registro.status,
    mensagem: registro.mensagem,
    linhas: registro.linhas,
    importados: registro.importados,
    comErro: registro.comErro,
    horas: Number(registro.horas),
    periodo: registro.periodoInicio
      ? { inicio: dia(registro.periodoInicio), fim: dia(registro.periodoFim) }
      : null,
    projetos: registro.projetos ?? [],
    erros: registro.erros ?? [],
  };
}

/**
 * Grava todos os apontamentos ou nenhum. A conferência é refeita dentro de uma
 * transação serializável, como no cadastro manual, para que gravações simultâneas
 * não passem do limite de horas do dia. Quando dá certo, o histórico é gravado na
 * mesma transação: ou ficam os apontamentos e o registro, ou nenhum dos dois.
 */
async function gravarImportacao(buffer, historico) {
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
    const resposta = { importados: resultado.resumo.validas, ...resultado.resumo };
    if (historico) {
      const { id } = await repositorio.registrar(
        {
          ...historico,
          ...dadosDoResumo(resultado),
          status: STATUS_IMPORTACAO.CONCLUIDA,
          importados: resultado.resumo.validas,
        },
        db,
      );
      resposta.historicoId = id;
    }
    return resposta;
  });
}
