import { mensagemDeErro } from "./download.js";

// Mensagens dos critérios de aceite das exportações do relatório (PDF e XLSX).
const FORMATOS = { pdf: "PDF", xlsx: "XLSX" };

export const sucessoDoArquivo = (formato, nome) =>
  `Relatório ${FORMATOS[formato]} exportado com sucesso: ${nome}.`;

/** Sem relatório válido (inexistente, formato desconhecido ou sem dados), a mensagem é fixa. */
export async function falhaDoArquivo(error, formato, padrao) {
  if ([404, 409, 422].includes(error.response?.status))
    return formato === "pdf"
      ? "Não há dados disponíveis para exportação."
      : "Não há relatório válido para exportar.";
  return mensagemDeErro(error, padrao);
}
