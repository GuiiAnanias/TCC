import prisma from "../config/prisma.js";

export const sessoesRepository = {
  async create(user, data) {
    return prisma.$transaction(async (db) => {
      // Serializa a emissão com troca de senha/inativação da mesma conta.
      await db.$queryRaw`SELECT id FROM usuarios WHERE id = ${user.id} FOR SHARE`;
      const current = await db.usuario.findUnique({ where: { id: user.id } });
      if (
        !current ||
        current.status !== "ATIVO" ||
        current.senhaHash !== user.senhaHash ||
        current.versaoSessao !== user.versaoSessao
      )
        return null;
      return db.sessao.create({
        data: { ...data, usuarioId: user.id, versaoSessao: current.versaoSessao },
      });
    });
  },
  findById(id) {
    return prisma.sessao.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nomeUsuario: true, email: true, status: true, versaoSessao: true },
        },
      },
    });
  },
  revoke(id, usuarioId) {
    return prisma.sessao.updateMany({
      where: { id, usuarioId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  },
};
