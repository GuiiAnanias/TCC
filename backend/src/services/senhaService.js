/**
 * [SERVICE][SEGURANCA] Recuperação de senha por e-mail: gera o link com token aleatório, guarda só
 * o hash do token, valida o link e grava a nova senha com bcrypt. O link vale 30 minutos e uma vez
 * só.
 */

import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { usuariosRepository } from "../repositories/usuariosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { novaSenhaSchema } from "../schemas/senhaSchemas.js";
import { emailService } from "./emailService.js";

// Recuperação de senha por link de uso único, válido por 30 minutos. O link chega por
// e-mail quando o próprio usuário pede em "Esqueci minha senha"; quem administra o
// servidor também pode gerá-lo (scripts/gerar-link-senha.mjs). Só o hash do token fica
// no banco, então quem lê a tabela de usuários não consegue usar o link.
export const VALIDADE_LINK_MINUTOS = 30;
export const MENSAGEM_SOLICITACAO =
  "Caso o e-mail informado esteja cadastrado, será enviado um link de redefinição de senha.";
// [SEGURANCA] O banco guarda o SHA-256 do token; quem ler o banco não consegue usar o link.
export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const LINK_INVALIDO = 'Link inválido ou expirado. Solicite um novo link em "Esqueci minha senha".';

// [SEGURANCA] Token de 32 bytes aleatórios (crypto.randomBytes) e validade gravada junto com o
// hash.
async function criarLink(usuario, frontendUrl, agora) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MINUTOS * 60 * 1000);
  await usuariosRepository.saveResetToken(usuario.id, hashToken(token), expiraEm);
  const base = String(frontendUrl).replace(/\/+$/, "");
  return { expiraEm, link: `${base}/redefinir-senha?token=${token}` };
}

// Link válido: pertence a uma conta ativa, não foi usado nem substituído e não expirou.
async function usuarioDoLink(token, agora) {
  const tokenHash = hashToken(token);
  const usuario = await usuariosRepository.findByResetToken(tokenHash);
  const expirado = !usuario?.resetTokenExpiraEm || new Date(usuario.resetTokenExpiraEm) <= agora;
  if (!usuario || usuario.status !== "ATIVO" || expirado) throw new HttpError(400, LINK_INVALIDO);
  return { usuario, tokenHash };
}

function mensagemEmail(usuario, link) {
  const texto = [
    `Olá, ${usuario.nomeUsuario}.`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no CODE BI.",
    `Para escolher uma nova senha, abra o link abaixo. Ele vale por ${VALIDADE_LINK_MINUTOS} minutos e só pode ser usado uma vez:`,
    "",
    link,
    "",
    "Se você não fez esse pedido, ignore este e-mail: sua senha atual continua valendo.",
  ].join("\n");
  const html = `<p>Olá, ${escapeHtml(usuario.nomeUsuario)}.</p>
<p>Recebemos um pedido para redefinir a senha da sua conta no CODE BI.</p>
<p>Para escolher uma nova senha, clique no link abaixo. Ele vale por ${VALIDADE_LINK_MINUTOS} minutos e só pode ser usado uma vez.</p>
<p><a href="${escapeHtml(link)}">Redefinir minha senha</a></p>
<p>Se você não fez esse pedido, ignore este e-mail: sua senha atual continua valendo.</p>`;
  return { assunto: "Redefinição de senha — CODE BI", texto, html };
}

// [SEGURANCA] Escapa o nome do usuário antes de colocá-lo no HTML do e-mail.
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

export const senhaService = {
  // Gera o link para um usuário pelo login (uso administrativo, sem e-mail).
  async gerarLink(login, { frontendUrl, agora = new Date() }) {
    const usuario = await usuariosRepository.findByLogin(login);
    if (!usuario) throw new HttpError(404, `Usuário "${login}" não encontrado.`);
    if (usuario.status !== "ATIVO")
      throw new HttpError(409, `O usuário "${usuario.nomeUsuario}" está inativo.`);
    const { expiraEm, link } = await criarLink(usuario, frontendUrl, agora);
    return { usuario: usuario.nomeUsuario, expiraEm, link };
  },

  // Pedido feito pelo próprio usuário. Não informa se o e-mail existe: a rota sempre
  // responde a mesma mensagem e o envio acontece depois da resposta. Retorna se um
  // e-mail foi enviado, apenas para testes e registros do servidor.
  async solicitarPorEmail(email, { frontendUrl, agora = new Date() }) {
    const usuario = await usuariosRepository.findByEmail(email);
    if (!usuario || usuario.status !== "ATIVO") return false;
    const { link } = await criarLink(usuario, frontendUrl, agora);
    const { assunto, texto, html } = mensagemEmail(usuario, link);
    await emailService.enviar({ para: usuario.email, assunto, texto, html });
    return true;
  },

  // Conferência feita ao abrir a tela do link: se ele já foi usado, expirou ou é
  // desconhecido, a tela avisa na hora e nem mostra o formulário. Não consome o link.
  async validarLink(token, agora = new Date()) {
    await usuarioDoLink(token, agora);
  },

  // [SEGURANCA][VALIDACAO] Confere a senha forte, o link (existe, não venceu, não foi usado) e
  // grava o novo hash; o link é consumido na mesma gravação.
  async redefinir(token, novaSenha, agora = new Date()) {
    novaSenhaSchema.parse(novaSenha);
    const { usuario, tokenHash } = await usuarioDoLink(token, agora);
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    if (!(await usuariosRepository.consumeResetToken(usuario.id, tokenHash, senhaHash, agora)))
      throw new HttpError(400, LINK_INVALIDO);
  },
};
