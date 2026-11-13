/**
 * [REPOSITORY][BANCO] Consultas e gravações de apontamentos de horas.
 */

import prisma from "../config/prisma.js";
import { HttpError } from "../utils/HttpError.js";
import { custoConflict } from "../utils/custoConflict.js";

export const apontamentosRepository = {
  // [TRANSACAO] Trava colaborador e projeto do apontamento até o fim da transação.
  async lockReferences({ colaboradorId, projetoId }, db = prisma) {
    // A inativação precisa esperar o lançamento terminar (ou vice-versa).
    // Sempre bloquear pessoa antes de projeto para manter a ordem consistente.
    if (colaboradorId)
      await db.$queryRaw`SELECT id FROM colaboradores WHERE id = ${colaboradorId} FOR SHARE`;
    if (projetoId) await db.$queryRaw`SELECT id FROM projetos WHERE id = ${projetoId} FOR SHARE`;
  },
  // [TRANSACAO] Transação Serializable: dois lançamentos simultâneos não conseguem, juntos, passar
  // de 24 h no dia.
  async transaction(operation) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // A leitura da soma e a escrita precisam compartilhar o mesmo snapshot.
        // Serializable protege inclusive o primeiro lançamento de um dia vazio.
        return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
      } catch (error) {
        const conflict = custoConflict(error);
        if (conflict) throw conflict;
        if (
          error.code !== "P2034" &&
          !(error.code === "P2010" && ["40001", "40P01"].includes(error.meta?.code))
        )
          throw error;
        if (attempt === 2)
          throw new HttpError(
            409,
            "Os apontamentos foram alterados em outra operação. Atualize e tente novamente.",
          );
      }
    }
  },

  // [BANCO] Lista com busca na descrição e filtros de colaborador, projeto, status e período.
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

  // [REGRA] Soma as horas do colaborador no dia (sem o próprio apontamento, na edição) para a regra
  // das 24 h.
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
