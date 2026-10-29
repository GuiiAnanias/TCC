import prisma from "../config/prisma.js";
import { HttpError } from "../utils/HttpError.js";

export const apontamentosRepository = {
  async transaction(operation) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // A leitura da soma e a escrita precisam compartilhar o mesmo snapshot.
        // Serializable protege inclusive o primeiro lançamento de um dia vazio.
        return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error.code !== "P2034") throw error;
        if (attempt === 2) throw new HttpError(409, "Os apontamentos foram alterados em outra operação. Atualize e tente novamente.");
      }
    }
  },

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
        tarefa: { select: { titulo: true } },
      },
      orderBy: [{ data: "desc" }],
    });
  },

  findById(id, db = prisma) {
    return db.apontamentoHora.findUnique({
      where: { id },
      include: {
        colaborador: { select: { nomeCompleto: true } },
        projeto: { select: { nome: true } },
        tarefa: { select: { titulo: true } },
      },
    });
  },

  async sumHorasNoDia(colaboradorId, data, excetoId, db = prisma) {
    const result = await db.apontamentoHora.aggregate({
      _sum: { horas: true },
      where: { colaboradorId, data, ...(excetoId ? { id: { not: excetoId } } : {}) },
    });
    return Number(result._sum.horas ?? 0);
  },

  create(data, db = prisma) {
    return db.apontamentoHora.create({ data });
  },

  update(id, data, db = prisma) {
    return db.apontamentoHora.update({ where: { id }, data });
  },

  delete(id, db = prisma) {
    return db.apontamentoHora.delete({ where: { id } });
  },
};
