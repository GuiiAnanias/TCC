import prisma from "../config/prisma.js";
export const apontamentosRepository = {
  findAll({ busca, colaboradorId, projetoId, dataInicio, dataFim, status } = {}) {
    return prisma.apontamentoHora.findMany({
      where: {
        ...(busca ? { descricao: { contains: busca, mode: "insensitive" } } : {}),
        ...(colaboradorId ? { colaboradorId } : {}),
        ...(projetoId ? { projetoId } : {}),
        ...(status ? { status } : {}),
        ...(dataInicio || dataFim
          ? {
              data: {
                ...(dataInicio ? { gte: dataInicio } : {}),
                ...(dataFim ? { lte: dataFim } : {}),
              },
            }
          : {}),
      },
      include: {
        colaborador: { select: { nomeCompleto: true, cargo: true } },
        projeto: { select: { nome: true } },
      },
      orderBy: [{ data: "desc" }],
    });
  },

  findById(id) {
    return prisma.apontamentoHora.findUnique({
      where: { id },
      include: {
        colaborador: { select: { nomeCompleto: true } },
        projeto: { select: { nome: true } },
      },
    });
  },

  create(data) {
    return prisma.apontamentoHora.create({ data });
  },

  update(id, data) {
    return prisma.apontamentoHora.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.apontamentoHora.delete({ where: { id } });
  },
};