import { round } from "./operationalIndicators.js";
const dayOf = (value) => new Date(value).toISOString().slice(0, 10);

export function entryCost(entry, project, bonuses) {
  const day = dayOf(entry.data);
  const config = [...(entry.colaborador.configuracoesFinanceiras ?? [])]
    .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio) || (b.id || 0) - (a.id || 0))
    .find((item) => dayOf(item.dataInicio) <= day && (!item.dataFim || dayOf(item.dataFim) >= day));
  const member = [...(project.equipe ?? [])].sort((a, b) => new Date(b.dataEntrada) - new Date(a.dataEntrada))
    .find((row) => row.colaboradorId === entry.colaboradorId && dayOf(row.dataEntrada) <= day && (!row.dataSaida || dayOf(row.dataSaida) >= day));
  const bonus = member && [...bonuses].sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio))
    .find((row) => row.papel === member.papel && dayOf(row.dataInicio) <= day && (!row.dataFim || dayOf(row.dataFim) > day));
  const missing = !config || config.valorHoraAplicado == null || !Number.isFinite(Number(config.valorHoraAplicado));
  const rawBase = missing ? 0 : Number(entry.horas) * Number(config.valorHoraAplicado);
  const custoBase = round(rawBase), bonificacao = round(rawBase * Number(bonus?.percentual ?? 0) / 100);
  return { custoBase, bonificacao, custo: round(custoBase + bonificacao), semCusto: missing, semVinculo: !member,
    valorHora: missing ? null : Number(config.valorHoraAplicado), nivel: config?.nivelAplicado ?? null,
    papel: member?.papel ?? null, percentual: Number(bonus?.percentual ?? 0) };
}
