// Transcrição dos critérios selecionáveis nas abas Dev e PO e SM; deduções em BD.
// As faixas BD!H3:J6 não estão disponíveis. Nunca preencher com faixas presumidas.
const criterion = (chave, titulo, deducao, fonte) => ({ chave, titulo, deducao, fonte });
export const premiacaoTemplates = {
  DEV: {
    nome: "Dev — critérios da planilha", categoria: "DEV", pontuacaoBase: 10, faixas: [],
    criterios: [
      criterion("estimativas", "Assertividade do tempo estimado inferior a 75%", 1, "Dev!C37; BD!T2"),
      criterion("sem_horas", "Tarefas concluídas sem registro de execução", 1, "Dev!C38; BD!T3"),
      criterion("registro_tardio", "Horas lançadas após a finalização da sprint", 1, "Dev!C39; BD!T4"),
      criterion("sem_estimativa", "Tarefas sem estimativa de tempo", 1, "Dev!C40; BD!T5"),
      criterion("correcao_original", "Correção acima de 15% do tempo da tarefa original, com responsabilidade pelo erro verificada", 0.5, "Dev!C41; BD!T6"),
      criterion("volume_correcao", "Quantidade de tarefas de correção superior a 10% das tarefas", 0.5, "Dev!C42; BD!T7"),
      criterion("atrasos", "Mais de 10% das tarefas entregues fora do prazo", 1, "Dev!C43; BD!T8"),
      criterion("notificacoes", "Notificações registradas no período (ausências, comunicação ou comportamento)", 2, "Dev!C44:C46; BD!T9")
    ]
  },
  PO_SM: {
    nome: "PO/SM — critérios da planilha", categoria: "PO_SM", pontuacaoBase: 10, faixas: [],
    criterios: [
      criterion("impedimento_justificativa", "Impedimentos sem justificativa registrada", 0.5, "PO e SM!C37; BD!AB3"),
      criterion("impedimento_resposta", "Impedimentos com mais de cinco dias sem resposta ou encaminhamento", 1, "PO e SM!C38; BD!AB4"),
      criterion("sprint_aberta", "Tarefas abertas em sprints finalizadas", 1, "PO e SM!C39; BD!AB5"),
      criterion("sem_estimativa", "Tarefas sem estimativa de tempo", 1, "PO e SM!C40; BD!AB6"),
      criterion("sem_horas", "Tarefas concluídas sem registro de execução", 1, "PO e SM!C41; BD!AB7"),
      criterion("registro_tardio", "Horas lançadas após a finalização da sprint", 1, "PO e SM!C42; BD!AB8"),
      criterion("sem_prazo", "Tarefas sem data de vencimento", 1, "PO e SM!C43; BD!AB9"),
      criterion("estimativas", "Assertividade do tempo estimado inferior a 75%", 1, "PO e SM!C44; BD!AB10"),
      criterion("requisitos", "Tarefas sem os requisitos mínimos definidos", 1, "PO e SM!C45; BD!AB11"),
      criterion("sem_sprint", "Tarefas fora de uma sprint", 1, "PO e SM!C46; BD!AB12 — incluído apesar da soma R52 omitir R46")
    ]
  }
};

export const round = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;
export function calculateAward(rule, input) {
  const respostas = new Map(input.respostas.map((row) => [row.chave, row]));
  const pendentes = rule.criterios.filter((row) => !respostas.has(row.chave) || respostas.get(row.chave).situacao === "PENDENTE").length;
  const deducoes = round(rule.criterios.reduce((total, row) => total + (respostas.get(row.chave)?.situacao === "SIM" ? row.deducao : 0), 0));
  const notaProvisoria = round(rule.pontuacaoBase - deducoes);
  const notaFinal = pendentes ? null : notaProvisoria;
  const faixa = notaFinal == null ? null : rule.faixas.find((row) => notaFinal >= row.minimo && notaFinal <= row.maximo);
  const manual = input.percentualInformado != null;
  const percentualElegivel = notaFinal == null ? null : manual ? input.percentualInformado : faixa?.percentual ?? null;
  const percentualFinal = percentualElegivel == null || input.percentualBase == null ? null : round(input.percentualBase * percentualElegivel / 100);
  const motivos = [];
  if (pendentes) motivos.push(`${pendentes} critério(s) aguardando conferência.`);
  if (input.percentualBase == null) motivos.push("Percentual-base de premiação não informado.");
  if (!pendentes && percentualElegivel == null) motivos.push("Sem faixa configurada para esta nota e sem percentual informado com justificativa.");
  return { pontuacaoBase: rule.pontuacaoBase, deducoes, notaProvisoria, notaFinal, pendentes, percentualBase: input.percentualBase, percentualElegivel, percentualFinal, origemPercentual: manual ? "INFORMADO" : "FAIXA", motivos };
}
