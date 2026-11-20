/**
 * [REPOSITORY][BANCO][TRANSACAO] Vigências financeiras do colaborador. Criar uma vigência fecha a
 * anterior no dia anterior, tudo numa transação serializável; o histórico é imutável (gatilho no
 * banco).
 */

import prisma from "../config/prisma.js";
import { conflitoCusto } from "../utils/conflitoCusto.js";
import { ErroHttp } from "../utils/ErroHttp.js";
import {
  financeDay,
  financeDate,
  previousFinanceDay,
  todayFinanceDate,
} from "../utils/datasFinanceiras.js";

const include = { colaborador: true, itemTabela: true };

// [TRANSACAO] Transação Serializable com até 3 tentativas quando o PostgreSQL acusa conflito de
// concorrência.
async function financialTransaction(operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const conflict = conflitoCusto(error);
      if (conflict) throw conflict;
      if (error.code !== "P2034") throw error;
      if (attempt === 2)
        throw new ErroHttp(
          409,
          "A configuração financeira foi alterada em outra operação. Atualize e tente novamente.",
        );
    }
  }
}

// [TRANSACAO] Trava a linha do colaborador (FOR UPDATE) para duas vigências não serem criadas ao
// mesmo tempo. [ERRO] Colaborador inativo: 400; inexistente: 404.
async function lockActiveCollaborator(tx, colaboradorId) {
  await tx.$queryRaw`SELECT id FROM colaboradores WHERE id = ${colaboradorId} FOR UPDATE`;
  const collaborator = await tx.colaborador.findUnique({ where: { id: colaboradorId } });
  if (!collaborator) throw new ErroHttp(404, "Colaborador não encontrado.");
  if (collaborator.status !== "ATIVO")
    throw new ErroHttp(
      400,
      "Não é possível alterar configuração financeira de colaborador inativo.",
    );
}

export const configuracoesFinanceirasRepository = {
  // [BANCO] Histórico de vigências do colaborador, da mais recente para a mais antiga.
  findByColaborador(colaboradorId) {
    return prisma.configuracaoFinanceira.findMany({
      where: { colaboradorId },
      include,
      orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
    });
  },
  findById(id) {
    return prisma.configuracaoFinanceira.findUnique({ where: { id }, include });
  },
  // [REGRA][TRANSACAO] Cria a nova vigência e encerra a anterior no dia anterior ao início. Recusa
  // início antes de vigências anteriores ou antes do último apontamento (para não mudar custo de
  // horas já lançadas).
  replaceActive({
    colaboradorId,
    itemTabelaId,
    beneficios,
    dataInicio,
    motivo,
    usuarioId,
    expectedConfigId,
  }) {
    return financialTransaction(async (tx) => {
      await lockActiveCollaborator(tx, colaboradorId);
      const item = await tx.itemTabelaRemuneracao.findUnique({ where: { id: itemTabelaId } });
      if (!item) throw new ErroHttp(404, "Item da tabela de remuneração não encontrado.");
      if (item.status !== "ATIVO")
        throw new ErroHttp(400, "Item inativo na tabela de remuneração e bonificação.");
      const history = await tx.configuracaoFinanceira.findMany({
        where: { colaboradorId },
        orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
      });
      const open = history.filter((row) => !row.dataFim);
      if (open.length > 1)
        throw new ErroHttp(
          409,
          "Há mais de uma vigência financeira aberta. Confira o histórico antes de criar uma nova.",
        );
      const current = open[0];
      if (expectedConfigId && current?.id !== expectedConfigId)
        throw new ErroHttp(
          409,
          "Esta configuração não é mais a vigência aberta. Atualize o histórico.",
        );
      const start = financeDate(dataInicio);
      if (history.some((row) => financeDay(row.dataInicio) >= financeDay(start)))
        throw new ErroHttp(
          400,
          "A nova vigência deve começar após o início das configurações já existentes.",
        );
      if (history.some((row) => row.dataFim && financeDay(row.dataFim) >= financeDay(start)))
        throw new ErroHttp(
          409,
          "A data escolhida sobrepõe uma vigência encerrada. Selecione uma data após o fim do histórico existente.",
        );
      const latestEntry = await tx.apontamentoHora.findFirst({
        where: { colaboradorId },
        orderBy: { data: "desc" },
        select: { data: true },
      });
      // A primeira configuração pode preencher horas antes sem custo. Depois disso,
      // uma nova vigência não pode reinterpretar apontamentos já registrados.
      if (history.length && latestEntry && financeDay(latestEntry.data) >= financeDay(start))
        throw new ErroHttp(
          409,
          `Para preservar as horas registradas, a nova vigência deve começar após ${financeDay(latestEntry.data)}.`,
        );
      if (current)
        await tx.configuracaoFinanceira.update({
          where: { id: current.id },
          data: { dataFim: previousFinanceDay(start), encerradoPorId: usuarioId ?? null },
        });
      return tx.configuracaoFinanceira.create({
        data: {
          colaboradorId,
          itemTabelaId,
          beneficios,
          dataInicio: start,
          valorHoraAplicado: item.valorHora,
          nivelAplicado: item.nivel,
          origemValorHora: "VINCULO",
          motivo: motivo?.trim() || "Nova vigência",
          anteriorId: current?.id ?? history[0]?.id ?? null,
          criadoPorId: usuarioId ?? null,
        },
        include,
      });
    });
  },
  // [REGRA] Encerra a vigência aberta com a data de hoje.
  close(colaboradorId, configuracaoId, usuarioId) {
    return financialTransaction(async (tx) => {
      await lockActiveCollaborator(tx, colaboradorId);
      const config = await tx.configuracaoFinanceira.findUnique({
        where: { id: configuracaoId },
        include,
      });
      if (!config || config.colaboradorId !== colaboradorId)
        throw new ErroHttp(404, "Configuração financeira não encontrada para este colaborador.");
      if (config.dataFim) return config;
      const end = todayFinanceDate();
      if (financeDay(config.dataInicio) > financeDay(end))
        throw new ErroHttp(400, "Não é possível encerrar uma vigência antes da data de início.");
      const laterEntry = await tx.apontamentoHora.findFirst({
        where: { colaboradorId, data: { gte: new Date(end.getTime() + 86400000) } },
        select: { id: true },
      });
      if (laterEntry)
        throw new ErroHttp(
          409,
          "Há apontamentos após a data de encerramento. O histórico financeiro dessas horas deve ser preservado.",
        );
      return tx.configuracaoFinanceira.update({
        where: { id: configuracaoId },
        data: { dataFim: end, encerradoPorId: usuarioId ?? null },
        include,
      });
    });
  },
};
