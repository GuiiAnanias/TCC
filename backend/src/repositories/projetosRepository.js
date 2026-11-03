import prisma from "../config/prisma.js";
import { HttpError } from "../utils/HttpError.js";
import { previousFinanceDay } from "../utils/financeDates.js";

const projectListInclude = {
  cliente: true,
  _count: {
    select: {
      equipe: {
        where: {
          dataSaida: null,
        },
      },
    },
  },
};

export const projetosRepository = {
  async transaction(operation) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
      } catch (error) {
        if (
          error.code === "P2002" ||
          error.code === "P2004" ||
          error.message?.includes("equipe_periodos_sem_sobreposicao")
        )
          throw new HttpError(
            409,
            "Já existe participação deste colaborador no período informado.",
          );
        if (error.code !== "P2034") throw error;
        if (attempt === 2)
          throw new HttpError(
            409,
            "A equipe foi alterada em outra operação. Atualize e tente novamente.",
          );
      }
    }
  },
  findOverlappingTeamMember(
    projetoId,
    colaboradorId,
    dataEntrada,
    dataSaida,
    exceptId,
    db = prisma,
  ) {
    return db.projetoColaborador.findFirst({
      where: {
        projetoId,
        colaboradorId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
        ...(dataSaida ? { dataEntrada: { lte: dataSaida } } : {}),
        OR: [{ dataSaida: null }, { dataSaida: { gte: dataEntrada } }],
      },
    });
  },
  findAll({ busca, status, clienteId } = {}) {
    return prisma.projeto.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(busca ? { nome: { contains: busca, mode: "insensitive" } } : {}),
      },
      include: projectListInclude,
      orderBy: [{ status: "asc" }, { nome: "asc" }],
    });
  },

  findById(id, db = prisma) {
    return db.projeto.findUnique({
      where: { id },
      include: {
        cliente: true,
        equipe: {
          include: {
            colaborador: true,
          },
          orderBy: [{ dataSaida: "desc" }, { dataEntrada: "desc" }],
        },
      },
    });
  },

  create(data) {
    return prisma.projeto.create({
      data,
      include: projectListInclude,
    });
  },

  update(id, data) {
    return prisma.projeto.update({
      where: { id },
      data,
      include: projectListInclude,
    });
  },

  findTeamByProject(projetoId) {
    return prisma.projetoColaborador.findMany({
      where: { projetoId },
      include: {
        colaborador: true,
      },
      orderBy: [{ dataSaida: "desc" }, { dataEntrada: "desc" }],
    });
  },

  findTeamMemberById(id, db = prisma) {
    return db.projetoColaborador.findUnique({
      where: { id },
      include: {
        colaborador: true,
        projeto: true,
      },
    });
  },

  findActiveTeamMember(projetoId, colaboradorId) {
    return prisma.projetoColaborador.findFirst({
      where: {
        projetoId,
        colaboradorId,
        dataSaida: null,
      },
    });
  },

  addTeamMember(data, db = prisma) {
    return db.projetoColaborador.create({
      data,
      include: {
        colaborador: true,
      },
    });
  },

  updateTeamMember(id, data, db = prisma) {
    return db.projetoColaborador.update({
      where: { id },
      data,
      include: {
        colaborador: true,
      },
    });
  },

  async changeTeamRole(member, papel, dataVigencia, tx) {
    const closed = await tx.projetoColaborador.updateMany({
      where: { id: member.id, dataSaida: null, papel: member.papel },
      data: { dataSaida: previousFinanceDay(dataVigencia) },
    });
    if (closed.count !== 1)
      throw new HttpError(409, "O vínculo foi alterado. Atualize a equipe e tente novamente.");
    return tx.projetoColaborador.create({
      data: {
        projetoId: member.projetoId,
        colaboradorId: member.colaboradorId,
        papel,
        dataEntrada: dataVigencia,
      },
      include: { colaborador: true },
    });
  },
};
