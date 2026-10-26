import prisma from "../config/prisma.js";

export const usuariosRepository = {
  findByLogin(login) {
    return prisma.usuario.findFirst({ where: { OR: [{ email: login }, { nomeUsuario: login }] } });
  },

  findByResetToken(tokenHash) {
    return prisma.usuario.findFirst({ where: { resetToken: tokenHash } });
  },

  saveResetToken(id, tokenHash, expiraEm) {
    return prisma.usuario.update({ where: { id }, data: { resetToken: tokenHash, resetTokenExpiraEm: expiraEm } });
  },

  // Troca a senha e apaga o token numa única escrita condicional: se dois pedidos
  // usarem o mesmo link ao mesmo tempo, só um deles consegue.
  async consumeResetToken(id, tokenHash, senhaHash, agora) {
    const result = await prisma.usuario.updateMany({
      where: { id, resetToken: tokenHash, resetTokenExpiraEm: { gt: agora } },
      data: { senhaHash, resetToken: null, resetTokenExpiraEm: null }
    });
    return result.count === 1;
  }
};
