import prisma from "../config/prisma.js";

export const clientesRepository = {
  findAll({ busca, status } = {}) {
    return prisma.cliente.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                { nomeFantasia: { contains: busca, mode: "insensitive" } },
                {
                  cnpj: {
                    contains: busca.toUpperCase().replace(/[./\-\s]/g, "") || busca,
                    mode: "insensitive",
                  },
                },
                { cpf: { contains: busca.replace(/[.\-\s]/g, "") || busca } },
                { cidade: { contains: busca, mode: "insensitive" } },
                { email: { contains: busca, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { nome: "asc" }],
    });
  },

  findById(id, db = prisma) {
    return db.cliente.findUnique({ where: { id } });
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
  async findIndividualByEmail(email, excludeId = 0) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM clientes
      WHERE "tipoPessoa" = 'PF' AND id <> ${excludeId}
        AND lower(btrim(email)) = lower(btrim(${email}))
      LIMIT 1
    `;
    return rows[0] || null;
  },
  async findIndividualByTelefone(telefone, excludeId = 0) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM clientes
      WHERE "tipoPessoa" = 'PF' AND id <> ${excludeId}
        AND regexp_replace(telefone, '[^0-9]', '', 'g') = ${telefone.replace(/\D/g, "")}
      LIMIT 1
    `;
    return rows[0] || null;
  },

  create(data) {
    return prisma.cliente.create({ data });
  },

  update(id, data) {
    return prisma.cliente.update({
      where: { id },
      data,
    });
  },
};
