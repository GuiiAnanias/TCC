/**
 * Funções comuns das planilhas Excel (exceljs), usadas na importação de horas e nos relatórios:
 * criar e ler a pasta de trabalho, estilos de título e tabela, conversão de valores e datas.
 * [SEGURANCA] tamanhoDescompactado barra arquivos .xlsx que crescem demais ao descompactar.
 */

import ExcelJS from "exceljs";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Códigos de formato do Excel. O Excel troca ponto e vírgula conforme o idioma do
// computador, então "#,##0.00" aparece como 1.234,56 em português.
export const FORMATOS = {
  moeda: '"R$" #,##0.00',
  numero: "#,##0.00",
  inteiro: "0",
  data: "dd/mm/yyyy",
  percentual: "0.00%",
};

const COR_CABECALHO = "FF1F4E5F";
const COR_TITULO = "FF1F4E5F";

export function novaPasta() {
  const pasta = new ExcelJS.Workbook();
  pasta.creator = "CODE BI";
  pasta.created = new Date();
  return pasta;
}

/**
 * Soma o tamanho descompactado declarado no índice do ZIP (todo .xlsx é um ZIP), sem
 * descompactar nada. Serve para recusar "bombas de ZIP": arquivos pequenos que viram
 * centenas de megabytes na memória. Devolve null se o índice não puder ser lido.
 */
// [SEGURANCA] Soma o tamanho real dos arquivos dentro do .xlsx (que é um zip) antes de abrir,
// contra arquivo pequeno que explode ao descompactar.
export function tamanhoDescompactado(buffer) {
  const minimo = 22;
  if (buffer.length < minimo) return null;
  // O registro final do índice fica nos últimos 64 KB do arquivo.
  for (let fim = buffer.length - minimo; fim >= Math.max(0, buffer.length - 65557); fim--) {
    if (buffer.readUInt32LE(fim) !== 0x06054b50) continue;
    const entradas = buffer.readUInt16LE(fim + 10);
    let posicao = buffer.readUInt32LE(fim + 16);
    let total = 0;
    for (let indice = 0; indice < entradas; indice++) {
      if (posicao + 46 > buffer.length || buffer.readUInt32LE(posicao) !== 0x02014b50) return null;
      total += buffer.readUInt32LE(posicao + 24);
      posicao +=
        46 +
        buffer.readUInt16LE(posicao + 28) +
        buffer.readUInt16LE(posicao + 30) +
        buffer.readUInt16LE(posicao + 32);
    }
    return total;
  }
  return null;
}

export async function lerPasta(buffer) {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(buffer);
  return pasta;
}

export async function paraBuffer(pasta) {
  return Buffer.from(await pasta.xlsx.writeBuffer());
}

/** Cabeçalho em destaque só nas colunas usadas (estilo na linha inteira pintaria até o fim). */
export function estilizarCabecalho(linha, totalColunas) {
  for (let coluna = 1; coluna <= totalColunas; coluna++) {
    const celula = linha.getCell(coluna);
    celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    celula.alignment = { vertical: "middle", wrapText: true };
  }
}

export function escreverTitulo(aba, texto, subtitulo) {
  aba.getCell("A1").value = texto;
  aba.getCell("A1").font = { bold: true, size: 16, color: { argb: COR_TITULO } };
  if (subtitulo) {
    aba.getCell("A2").value = subtitulo;
    aba.getCell("A2").font = { italic: true, color: { argb: "FF555555" } };
  }
}

/**
 * Escreve uma lista de registros como Tabela do Excel (filtro, listras e nome
 * próprio), o formato que o Power BI reconhece direto na importação.
 * Sem registros, escreve só o cabeçalho e um aviso: o Excel não aceita tabela vazia.
 */
export function escreverTabela(aba, { nome, colunas, linhas, linhaInicial = 1 }) {
  colunas.forEach((coluna, indice) => {
    aba.getColumn(indice + 1).width = coluna.largura ?? 16;
  });
  if (linhas.length) {
    aba.addTable({
      name: nome,
      ref: `A${linhaInicial}`,
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: colunas.map((coluna) => ({ name: coluna.titulo, filterButton: true })),
      rows: linhas.map((linha) => colunas.map((coluna) => valorParaCelula(linha[coluna.chave]))),
    });
  } else {
    const cabecalho = aba.getRow(linhaInicial);
    cabecalho.values = colunas.map((coluna) => coluna.titulo);
    estilizarCabecalho(cabecalho, colunas.length);
    aba.getCell(`A${linhaInicial + 1}`).value = "Sem dados no recorte selecionado.";
    aba.getCell(`A${linhaInicial + 1}`).font = { italic: true, color: { argb: "FF777777" } };
  }
  colunas.forEach((coluna, indice) => {
    if (!coluna.formato) return;
    for (let linha = linhaInicial + 1; linha <= linhaInicial + linhas.length; linha++)
      aba.getRow(linha).getCell(indice + 1).numFmt = coluna.formato;
  });
  aba.views = [{ state: "frozen", ySplit: linhaInicial }];
}

function valorParaCelula(valor) {
  if (valor === undefined) return null;
  if (typeof valor === "number" && !Number.isFinite(valor)) return null;
  return valor;
}

/** Converte o conteúdo de uma célula do ExcelJS no valor simples que ela mostra. */
export function valorDaCelula(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date || typeof valor !== "object") return valor;
  if ("result" in valor) return valorDaCelula(valor.result);
  if (Array.isArray(valor.richText)) return valor.richText.map((parte) => parte.text).join("");
  if ("text" in valor) return valorDaCelula(valor.text);
  if ("error" in valor) return null;
  return String(valor);
}

/** Texto para comparar nomes: sem acento, sem diferença de maiúsculas e espaços extras. */
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const diaIso = (data) => data.toISOString().slice(0, 10);
export const dataUtc = (diaIsoTexto) => new Date(`${diaIsoTexto}T00:00:00.000Z`);
export const dataBr = (diaIsoTexto) => diaIsoTexto.split("-").reverse().join("/");
