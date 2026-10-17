import prisma from "../config/prisma.js";

export const clientesRepository = {
  findAll({ busca, status } = {}) {
    return prisma.cliente.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(busca ? { OR: [
          { nome: { contains: busca, mode: "insensitive" } },
          { nomeFantasia: { contains: busca, mode: "insensitive" } },
          { cnpj: { contains: busca.toUpperCase().replace(/[.\/\-\s]/g, "") || busca, mode: "insensitive" } },
          { cpf: { contains: busca.replace(/[.\-\s]/g, "") || busca } },
          { cidade: { contains: busca, mode: "insensitive" } },
          { email: { contains: busca, mode: "insensitive" } }
        ] } : {})
      },
      orderBy: [{ status: "asc" }, { nome: "asc" }]
    });
  },

  findById(id) {
    return prisma.cliente.findUnique({ where: { id } });
  },

  findByNome(nome) {
    return prisma.cliente.findFirst({ where: { nome, tipoPessoa: "PJ" } });
  },
  findByCpf(cpf) {
    return prisma.cliente.findUnique({ where: { cpf } });
  },
  findByCnpj(cnpj) {
    return prisma.cliente.findUnique({ where: { cnpj } });
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
