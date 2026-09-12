import prisma from "../config/prisma.js";

const projectListInclude = {
  cliente: true,
  _count: {
    select: {
      equipe: {
        where: {
          dataSaida: null
        }
      }
    }
  }
};

export const projetosRepository = {
  findAll({ busca, status, clienteId } = {}) {
    return prisma.projeto.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(busca ? { nome: { contains: busca, mode: "insensitive" } } : {})
      },
      include: projectListInclude,
      orderBy: [{ status: "asc" }, { nome: "asc" }]
    });
  },

  findById(id) {
    return prisma.projeto.findUnique({
      where: { id },
      include: {
        cliente: true,
        equipe: {
          include: {
            colaborador: true
          },
          orderBy: [{ dataSaida: "desc" }, { dataEntrada: "desc" }]
        }
      }
    });
  },

  create(data) {
    return prisma.projeto.create({
      data,
      include: projectListInclude
    });
  },

  update(id, data) {
    return prisma.projeto.update({
      where: { id },
      data,
      include: projectListInclude
    });
  },

  findTeamByProject(projetoId) {
    return prisma.projetoColaborador.findMany({
      where: { projetoId },
      include: {
        colaborador: true
      },
      orderBy: [{ dataSaida: "desc" }, { dataEntrada: "desc" }]
    });
  },

  findTeamMemberById(id) {
    return prisma.projetoColaborador.findUnique({
      where: { id },
      include: {
        colaborador: true,
        projeto: true
      }
    });
  },

  findActiveTeamMember(projetoId, colaboradorId) {
    return prisma.projetoColaborador.findFirst({
      where: {
        projetoId,
        colaboradorId,
        dataSaida: null
      }
    });
  },

  addTeamMember(data) {
    return prisma.projetoColaborador.create({
      data,
      include: {
        colaborador: true
      }
    });
  },

  updateTeamMember(id, data) {
    return prisma.projetoColaborador.update({
      where: { id },
      data,
      include: {
        colaborador: true
      }
    });
  }
};
