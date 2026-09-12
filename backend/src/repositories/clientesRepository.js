import prisma from "../config/prisma.js";

export const clientesRepository = {
  findAll({ busca, status } = {}) {
    return prisma.cliente.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(busca ? { nome: { contains: busca, mode: "insensitive" } } : {})
      },
      orderBy: [{ status: "asc" }, { nome: "asc" }]
    });
  },

  findById(id) {
    return prisma.cliente.findUnique({ where: { id } });
  },

  findByNome(nome) {
    return prisma.cliente.findUnique({ where: { nome } });
  },

  create(data) {
    return prisma.cliente.create({ data });
  },

  update(id, data) {
    return prisma.cliente.update({
      where: { id },
      data
    });
  }
};
