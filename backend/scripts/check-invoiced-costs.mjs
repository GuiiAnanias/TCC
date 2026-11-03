// Verificação somente de leitura, segura antes de aplicar as novas migrações.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { financeDay } from "../src/utils/financeDates.js";

const client = new PrismaClient();
try {
  const entries = await client.apontamentoHora.findMany({
    where: { status: "FATURADO" },
    select: {
      id: true,
      data: true,
      colaborador: { select: { configuracoesFinanceiras: true } },
      colaboradorId: true,
      projeto: { select: { equipe: true } },
    },
  });
  const bonuses = await client.bonificacaoPapel.findMany();
  const conflicts = [],
    pending = [];
  for (const entry of entries) {
    const day = financeDay(entry.data);
    const covers = (start, end, exclusive = false) =>
      financeDay(start) <= day &&
      (!end || (exclusive ? financeDay(end) > day : financeDay(end) >= day));
    const rates = entry.colaborador.configuracoesFinanceiras.filter((row) =>
      covers(row.dataInicio, row.dataFim),
    );
    const members = entry.projeto.equipe.filter(
      (row) => row.colaboradorId === entry.colaboradorId && covers(row.dataEntrada, row.dataSaida),
    );
    const rules =
      members.length === 1
        ? bonuses.filter(
            (row) => row.papel === members[0].papel && covers(row.dataInicio, row.dataFim, true),
          )
        : [];
    if (rates.length > 1 || members.length > 1 || rules.length > 1)
      conflicts.push({
        apontamentoId: entry.id,
        configuracoes: rates.map((row) => row.id),
        participacoes: members.map((row) => row.id),
        bonificacoes: rules.map((row) => row.id),
      });
    else if (!rates.length || !members.length)
      pending.push({
        apontamentoId: entry.id,
        semValorHora: !rates.length,
        semEquipe: !members.length,
      });
  }
  console.log(
    JSON.stringify(
      { faturados: entries.length, conflitos: conflicts, pendencias: pending },
      null,
      2,
    ),
  );
  if (conflicts.length) process.exitCode = 1;
} finally {
  await client.$disconnect();
}
