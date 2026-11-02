import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { usuariosRepository } from "../repositories/usuariosRepository.js";
import { HttpError } from "../utils/HttpError.js";

// Recuperação de senha sem e-mail: quem administra o servidor gera um link de uso
// único (scripts/gerar-link-senha.mjs) e entrega ao usuário. Só o hash do token fica
// no banco, então quem lê a tabela de usuários não consegue usar o link.
export const VALIDADE_LINK_MINUTOS = 30;
export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const LINK_INVALIDO = "Link inválido ou expirado. Peça um novo link ao administrador do sistema.";

export const senhaService = {
  async gerarLink(login, { frontendUrl, agora = new Date() }) {
    const usuario = await usuariosRepository.findByLogin(login);
    if (!usuario) throw new HttpError(404, `Usuário "${login}" não encontrado.`);
    if (usuario.status !== "ATIVO")
      throw new HttpError(409, `O usuário "${usuario.nomeUsuario}" está inativo.`);
    const token = crypto.randomBytes(32).toString("base64url");
    const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MINUTOS * 60 * 1000);
    await usuariosRepository.saveResetToken(usuario.id, hashToken(token), expiraEm);
    const base = String(frontendUrl).replace(/\/+$/, "");
    return {
      usuario: usuario.nomeUsuario,
      expiraEm,
      link: `${base}/redefinir-senha?token=${token}`,
    };
  },

  async redefinir(token, novaSenha, agora = new Date()) {
    const tokenHash = hashToken(token);
    const usuario = await usuariosRepository.findByResetToken(tokenHash);
    const expirado = !usuario?.resetTokenExpiraEm || new Date(usuario.resetTokenExpiraEm) <= agora;
    if (!usuario || usuario.status !== "ATIVO" || expirado) throw new HttpError(400, LINK_INVALIDO);
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    if (!(await usuariosRepository.consumeResetToken(usuario.id, tokenHash, senhaHash, agora)))
      throw new HttpError(400, LINK_INVALIDO);
  },
};
