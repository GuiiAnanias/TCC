/**
 * [REPOSITORY][BANCO] Consultas e gravações de clientes no PostgreSQL via Prisma. Só os services
 * chamam este arquivo.
 */

import prisma from "../config/prisma.js";

export const clientesRepository = {
  // [BANCO] Lista com busca por nome, nome fantasia, CNPJ, CPF, cidade e e-mail e filtro de status.
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

  // [BANCO] Buscas usadas pelo service para impedir duplicidade (nome de PJ, CPF, CNPJ, e-mail e
  // telefone de PF).
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

  // [BANCO] Grava o cliente já validado.
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
