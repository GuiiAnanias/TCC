/**
 * [REGRA] Cálculo do custo de cada apontamento: custo base = horas x valor/hora vigente na data;
 * bonificação = custo base x percentual do papel / 100; custo = base + bonificação. Apontamento
 * faturado usa a composição gravada no faturamento.
 */

import { round } from "./indicadoresOperacionais.js";
const dayOf = (value) => new Date(value).toISOString().slice(0, 10);

// [REGRA] Custo de um apontamento; marca semCusto (sem valor/hora) e semVinculo (fora da equipe)
// para os avisos de custo incompleto.
export function entryCost(entry, project, bonuses) {
  if (entry.status === "FATURADO" && entry.custoConsolidado) {
    const {
      custoBase,
      bonificacao,
      custo,
      semCusto,
      semVinculo,
      valorHora,
      nivel,
      papel,
      percentual,
    } = entry.custoConsolidado;
    return {
      custoBase,
      bonificacao,
      custo,
      semCusto,
      semVinculo,
      valorHora,
      nivel,
      papel,
      percentual,
    };
  }
  const day = dayOf(entry.data);
  const config = [...(entry.colaborador.configuracoesFinanceiras ?? [])]
    .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio) || (b.id || 0) - (a.id || 0))
    .find((item) => dayOf(item.dataInicio) <= day && (!item.dataFim || dayOf(item.dataFim) >= day));
  const member = [...(project.equipe ?? [])]
    .sort((a, b) => new Date(b.dataEntrada) - new Date(a.dataEntrada))
    .find(
      (row) =>
        row.colaboradorId === entry.colaboradorId &&
        dayOf(row.dataEntrada) <= day &&
        (!row.dataSaida || dayOf(row.dataSaida) >= day),
    );
  const bonus =
    member &&
    [...bonuses]
      .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio))
      .find(
        (row) =>
          row.papel === member.papel &&
          dayOf(row.dataInicio) <= day &&
          (!row.dataFim || dayOf(row.dataFim) > day),
      );
  const missing =
    !config ||
    config.valorHoraAplicado == null ||
    !Number.isFinite(Number(config.valorHoraAplicado));
  const rawBase = missing ? 0 : Number(entry.horas) * Number(config.valorHoraAplicado);
  const custoBase = round(rawBase),
    bonificacao = round((rawBase * Number(bonus?.percentual ?? 0)) / 100);
  return {
    custoBase,
    bonificacao,
    custo: round(custoBase + bonificacao),
    semCusto: missing,
    semVinculo: !member,
    valorHora: missing ? null : Number(config.valorHoraAplicado),
    nivel: config?.nivelAplicado ?? null,
    papel: member?.papel ?? null,
    percentual: Number(bonus?.percentual ?? 0),
  };
}
