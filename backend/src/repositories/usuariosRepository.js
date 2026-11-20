/**
 * [REPOSITORY][BANCO][SEGURANCA] Usuários do sistema e o token de redefinição de senha (guardado só
 * como hash SHA-256).
 */

import prisma from "../config/prisma.js";

export const usuariosRepository = {
  findByLogin(login) {
    return prisma.usuario.findFirst({ where: { OR: [{ email: login }, { nomeUsuario: login }] } });
  },

  // Recuperação pelo próprio usuário: somente pelo e-mail, sem diferenciar maiúsculas.
  findByEmail(email) {
    return prisma.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  },

  // [SEGURANCA] Procura pelo hash do token, nunca pelo token em texto.
  findByResetToken(tokenHash) {
    return prisma.usuario.findFirst({ where: { resetToken: tokenHash } });
  },

  // [SEGURANCA] Grava o hash do token e a validade; um novo pedido substitui o anterior.
  saveResetToken(id, tokenHash, expiraEm) {
    return prisma.usuario.update({
      where: { id },
      data: { resetToken: tokenHash, resetTokenExpiraEm: expiraEm },
    });
  },

  // Troca a senha e apaga o token numa única escrita condicional: se dois pedidos
  // usarem o mesmo link ao mesmo tempo, só um deles consegue.
  async consumeResetToken(id, tokenHash, senhaHash, agora) {
    const result = await prisma.usuario.updateMany({
      where: { id, status: "ATIVO", resetToken: tokenHash, resetTokenExpiraEm: { gt: agora } },
      data: {
        senhaHash,
        resetToken: null,
        resetTokenExpiraEm: null,
        versaoSessao: { increment: 1 },
      },
    });
    return result.count === 1;
  },
};
