/**
 * [REPOSITORY][BANCO][SEGURANCA] Sessões de login. Cada token JWT aponta para uma sessão; revogar a
 * sessão (Sair) invalida o token.
 */

import prisma from "../config/prisma.js";

export const sessoesRepository = {
  // [SEGURANCA][TRANSACAO] Cria a sessão só se a conta continua ativa e com a mesma senha (evita
  // sessão criada no meio de uma troca de senha).
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
  // [SEGURANCA] Usado pelo middleware authenticate em toda requisição protegida.
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
  // [SEGURANCA] Logout: marca a sessão como revogada.
  revoke(id, usuarioId) {
    return prisma.sessao.updateMany({
      where: { id, usuarioId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  },
};
