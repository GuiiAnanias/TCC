import prisma from "../config/prisma.js";
import { todayFinanceDate } from "../utils/financeDates.js";

const colaboradorInclude = () => ({
  configuracoesFinanceiras: {
    where: {
      dataInicio: { lt: new Date(todayFinanceDate().getTime() + 86400000) },
      OR: [{ dataFim: null }, { dataFim: { gte: todayFinanceDate() } }]
    },
    include: {
      itemTabela: true
    },
    orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
    take: 1
  }
});

export const colaboradoresRepository = {
  findAll({ busca, status } = {}) {
    return prisma.colaborador.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(busca
          ? {
              OR: [
                { nomeCompleto: { contains: busca, mode: "insensitive" } },
                { email: { contains: busca, mode: "insensitive" } },
                { cargo: { contains: busca, mode: "insensitive" } },
                { departamento: { contains: busca, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: colaboradorInclude(),
      orderBy: [{ status: "asc" }, { nomeCompleto: "asc" }]
    });
  },

  findById(id) {
    return prisma.colaborador.findUnique({
      where: { id },
      include: colaboradorInclude()
    });
  },

  findByEmail(email) {
    return prisma.colaborador.findUnique({ where: { email } });
  },

  create(data) {
    return prisma.colaborador.create({
      data,
      include: colaboradorInclude()
    });
  },

  update(id, data) {
    return prisma.colaborador.update({
      where: { id },
      data,
      include: colaboradorInclude()
    });
  }
};
