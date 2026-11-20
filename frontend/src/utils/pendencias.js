// Pendências que deixam o custo de um apontamento incompleto, com o link que abre o
// lugar certo para corrigir e já informa quem e qual data precisam de ajuste.

export const TIPOS_PENDENCIA_CUSTO = ["SEM_VINCULO", "SEM_REMUNERACAO"];

const dataBr = (dia) => String(dia).slice(0, 10).split("-").reverse().join("/");

export function linkDaPendencia(row) {
  const params = new URLSearchParams();
  if (row.tipo === "SEM_REMUNERACAO") {
    params.set("financeiro", row.colaboradorId);
  } else {
    params.set("equipe", row.projetoId);
    params.set("colaborador", row.colaboradorId);
  }
  params.set("data", String(row.data).slice(0, 10));
  return `${row.tipo === "SEM_REMUNERACAO" ? "/colaboradores" : "/projetos"}?${params}`;
}

/** Ocorrências de custo do dashboard, das mais recentes para as mais antigas. */
export function pendenciasDeCusto(ocorrencias = []) {
  return ocorrencias
    .filter((row) => TIPOS_PENDENCIA_CUSTO.includes(row.tipo))
    .sort(
      (a, b) =>
        String(b.data).localeCompare(String(a.data)) ||
        String(a.colaborador).localeCompare(String(b.colaborador), "pt-BR"),
    )
    .map((row) => ({
      ...row,
      link: linkDaPendencia(row),
      acao: row.tipo === "SEM_REMUNERACAO" ? "Cadastrar valor/hora" : "Ajustar equipe",
      problema:
        row.tipo === "SEM_REMUNERACAO"
          ? `Sem valor/hora vigente em ${dataBr(row.data)}: as horas ficaram sem custo.`
          : `Fora da equipe do projeto em ${dataBr(row.data)}: custo sem bonificação.`,
    }));
}

const cobre = (vinculo, dia) =>
  String(vinculo.dataEntrada).slice(0, 10) <= dia &&
  (!vinculo.dataSaida || String(vinculo.dataSaida).slice(0, 10) >= dia);

/**
 * Situação de um colaborador na equipe numa data:
 * - "sem-vinculo": nunca participou do projeto;
 * - "fora-do-periodo": participou, mas nenhuma participação cobre a data;
 * - "coberto": já existe participação na data (a pendência foi resolvida).
 */
export function situacaoNaEquipe(equipe, colaboradorId, dia) {
  const participacoes = equipe.filter(
    (vinculo) => String(vinculo.colaboradorId) === String(colaboradorId),
  );
  if (!participacoes.length) return { situacao: "sem-vinculo", participacoes };
  if (participacoes.some((vinculo) => cobre(vinculo, dia)))
    return { situacao: "coberto", participacoes };
  return { situacao: "fora-do-periodo", participacoes };
}

export { dataBr };
