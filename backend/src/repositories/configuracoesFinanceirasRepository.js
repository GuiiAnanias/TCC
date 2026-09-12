import prisma from "../config/prisma.js";

const configuracaoFinanceiraInclude = {
  colaborador: true,
  itemTabela: true
};

export const configuracoesFinanceirasRepository = {
  findByColaborador(colaboradorId) {
    return prisma.configuracaoFinanceira.findMany({
      where: { colaboradorId },
      include: configuracaoFinanceiraInclude,
      orderBy: [{ dataFim: "desc" }, { dataInicio: "desc" }]
    });
  },

  findById(id) {
    return prisma.configuracaoFinanceira.findUnique({
      where: { id },
      include: configuracaoFinanceiraInclude
    });
  },

  findActiveByColaborador(colaboradorId) {
    return prisma.configuracaoFinanceira.findFirst({
      where: {
        colaboradorId,
        dataFim: null
      },
      include: configuracaoFinanceiraInclude,
      orderBy: { dataInicio: "desc" }
    });
  },

  replaceActive(data) {
    return prisma.$transaction(async (transaction) => {
      const activeConfig = await transaction.configuracaoFinanceira.findFirst({
        where: {
          colaboradorId: data.colaboradorId,
          dataFim: null
        },
        orderBy: { dataInicio: "desc" }
      });

      if (activeConfig) {
        await transaction.configuracaoFinanceira.update({
          where: { id: activeConfig.id },
          data: {
            dataFim: data.dataInicio
          }
        });
      }

      return transaction.configuracaoFinanceira.create({
        data,
        include: configuracaoFinanceiraInclude
      });
    });
  },

  update(id, data) {
    return prisma.configuracaoFinanceira.update({
      where: { id },
      data,
      include: configuracaoFinanceiraInclude
    });
  }
};
