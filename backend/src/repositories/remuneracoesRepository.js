import prisma from "../config/prisma.js";

export const remuneracoesRepository = {
  findAll({ busca, status } = {}) {
    return prisma.itemTabelaRemuneracao.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(busca ? { nivel: { contains: busca, mode: "insensitive" } } : {}),
      },
      orderBy: [{ status: "asc" }, { nivel: "asc" }],
    });
  },

  findById(id) {
    return prisma.itemTabelaRemuneracao.findUnique({ where: { id } });
  },

  findByNivel(nivel) {
    return prisma.itemTabelaRemuneracao.findUnique({ where: { nivel } });
  },

  create(data) {
    return prisma.itemTabelaRemuneracao.create({ data });
  },

  update(id, data) {
    return prisma.itemTabelaRemuneracao.update({
      where: { id },
      data,
    });
  },
};
