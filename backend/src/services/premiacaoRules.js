// Modelos de exemplo de avaliação Dev e PO/SM. Cada empresa publica sua versão, ajustando a
// pontuação inicial, as deduções e as faixas; os modelos começam sem faixas presumidas.
// "fonte" indica onde conferir o critério antes de marcar a resposta.
const criterion = (chave, titulo, deducao, fonte) => ({ chave, titulo, deducao, fonte });
export const premiacaoTemplates = {
  DEV: {
    nome: "Dev — modelo de exemplo",
    categoria: "DEV",
    pontuacaoBase: 10,
    faixas: [],
    criterios: [
      criterion(
        "estimativas",
        "Assertividade do tempo estimado inferior a 75%",
        1,
        "Dashboard: assertividade das estimativas",
      ),
      criterion(
        "sem_horas",
        "Tarefas concluídas sem registro de execução",
        1,
        "Dashboard: tarefas concluídas sem horas",
      ),
      criterion(
        "registro_tardio",
        "Horas lançadas após a finalização da sprint",
        1,
        "Apontamentos com data após o fim da sprint",
      ),
      criterion(
        "sem_estimativa",
        "Tarefas sem estimativa de tempo",
        1,
        "Dashboard: tarefas sem estimativa",
      ),
      criterion(
        "correcao_original",
        "Correção acima de 15% do tempo da tarefa original, com responsabilidade pelo erro verificada",
        0.5,
        "Tarefas de correção; responsabilidade conferida pelo gestor",
      ),
      criterion(
        "volume_correcao",
        "Quantidade de tarefas de correção superior a 10% das tarefas",
        0.5,
        "Dashboard: percentual de correções",
      ),
      criterion(
        "atrasos",
        "Mais de 10% das tarefas entregues fora do prazo",
        1,
        "Conferência manual dos prazos combinados",
      ),
      criterion(
        "notificacoes",
        "Notificações registradas no período (ausências, comunicação ou comportamento)",
        2,
        "Conferência manual do gestor",
      ),
    ],
  },
  PO_SM: {
    nome: "PO/SM — modelo de exemplo",
    categoria: "PO_SM",
    pontuacaoBase: 10,
    faixas: [],
    criterios: [
      criterion(
        "impedimento_justificativa",
        "Impedimentos sem justificativa registrada",
        0.5,
        "Conferência manual dos impedimentos",
      ),
      criterion(
        "impedimento_resposta",
        "Impedimentos com mais de cinco dias sem resposta ou encaminhamento",
        1,
        "Conferência manual dos impedimentos",
      ),
      criterion(
        "sprint_aberta",
        "Tarefas abertas em sprints finalizadas",
        1,
        "Tarefas e sprints do projeto",
      ),
      criterion(
        "sem_estimativa",
        "Tarefas sem estimativa de tempo",
        1,
        "Dashboard: tarefas sem estimativa",
      ),
      criterion(
        "sem_horas",
        "Tarefas concluídas sem registro de execução",
        1,
        "Dashboard: tarefas concluídas sem horas",
      ),
      criterion(
        "registro_tardio",
        "Horas lançadas após a finalização da sprint",
        1,
        "Apontamentos com data após o fim da sprint",
      ),
      criterion(
        "sem_prazo",
        "Tarefas sem data de vencimento",
        1,
        "Conferência manual: o sistema não guarda vencimento",
      ),
      criterion(
        "estimativas",
        "Assertividade do tempo estimado inferior a 75%",
        1,
        "Dashboard: assertividade das estimativas",
      ),
      criterion(
        "requisitos",
        "Tarefas sem os requisitos mínimos definidos",
        1,
        "Descrição das tarefas",
      ),
      criterion(
        "sem_sprint",
        "Tarefas fora de uma sprint",
        1,
        "Tarefas sem sprint nos projetos avaliados",
      ),
    ],
  },
};

export const round = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;
export function calculateAward(rule, input) {
  const respostas = new Map(input.respostas.map((row) => [row.chave, row]));
  const pendentes = rule.criterios.filter(
    (row) => !respostas.has(row.chave) || respostas.get(row.chave).situacao === "PENDENTE",
  ).length;
  const deducoes = round(
    rule.criterios.reduce(
      (total, row) => total + (respostas.get(row.chave)?.situacao === "SIM" ? row.deducao : 0),
      0,
    ),
  );
  const notaProvisoria = round(rule.pontuacaoBase - deducoes);
  const notaFinal = pendentes ? null : notaProvisoria;
  const faixa =
    notaFinal == null
      ? null
      : rule.faixas.find((row) => notaFinal >= row.minimo && notaFinal <= row.maximo);
  const manual = input.percentualInformado != null;
  const percentualElegivel =
    notaFinal == null ? null : manual ? input.percentualInformado : (faixa?.percentual ?? null);
  const percentualFinal =
    percentualElegivel == null || input.percentualBase == null
      ? null
      : round((input.percentualBase * percentualElegivel) / 100);
  const motivos = [];
  if (pendentes) motivos.push(`${pendentes} critério(s) aguardando conferência.`);
  if (input.percentualBase == null) motivos.push("Percentual-base de premiação não informado.");
  if (!pendentes && percentualElegivel == null)
    motivos.push(
      "Sem faixa configurada para esta nota e sem percentual informado com justificativa.",
    );
  return {
    pontuacaoBase: rule.pontuacaoBase,
    deducoes,
    notaProvisoria,
    notaFinal,
    pendentes,
    percentualBase: input.percentualBase,
    percentualElegivel,
    percentualFinal,
    origemPercentual: manual ? "INFORMADO" : "FAIXA",
    motivos,
  };
}
