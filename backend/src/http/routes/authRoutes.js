/**
 * [ROTA][SEGURANCA] Rotas públicas de autenticação: login, esqueci minha senha, validação do link e
 * redefinição da senha; e, com login, /me e /logout.
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { authenticate } from "../middlewares/authenticate.js";
import { senhaService, MENSAGEM_SOLICITACAO } from "../../services/senhaService.js";
import { sessoesRepository } from "../../repositories/sessoesRepository.js";
import { novaSenhaSchema } from "../../schemas/senhaSchemas.js";
import { authRateLimit } from "../middlewares/authRateLimit.js";

// [SEGURANCA] Hash fictício: quando o usuário não existe, a senha é comparada mesmo assim, para o
// tempo de resposta não revelar quais usuários existem.
const dummyHash = bcrypt.hashSync("credencial-ficticia-para-comparacao", 10);

export const authRoutes = Router();
// [VALIDACAO] Corpo do login: usuário (ou e-mail) e senha obrigatórios.
const loginSchema = z.object({
  login: z.string().trim().min(1).max(254),
  senha: z.string().min(1).max(256),
});
// [VALIDACAO] Corpo do esqueci minha senha: e-mail.
const esqueciSenhaSchema = z.object({
  email: z
    .string({ message: "Informe o e-mail." })
    .trim()
    .min(1, "Informe o e-mail.")
    .max(254, "Informe um e-mail válido.")
    .email("Informe um e-mail válido."),
});
const tokenLinkSchema = z
  .string({ message: "Link inválido." })
  .trim()
  .min(20, "Link inválido.")
  .max(200, "Link inválido.");
const validarLinkSchema = z.object({ token: tokenLinkSchema });
// [VALIDACAO] Corpo da redefinição: token do link e nova senha, que passa pelas regras de senha
// forte (schemas/senhaSchemas.js).
const redefinirSenhaSchema = z.object({
  token: tokenLinkSchema,
  novaSenha: novaSenhaSchema,
});

// [ROTA] POST /api/auth/login. [SEGURANCA] Limite de tentativas, bcrypt.compare da senha, criação
// da sessão no banco e JWT com o id da sessão (jti). Erro genérico "Usuário ou senha inválidos"
// para não revelar qual dos dois errou.
authRoutes.post(
  "/login",
  authRateLimit("login", env.authLoginLimit, "login"),
  async (request, response, next) => {
    try {
      const { login, senha } = loginSchema.parse(request.body);
      const user = await prisma.usuario.findFirst({
        where: { OR: [{ email: login }, { nomeUsuario: login }] },
      });
      const valid = await bcrypt.compare(senha, user?.senhaHash ?? dummyHash);
      if (!user || !valid || user.status !== "ATIVO") {
        return response.status(401).json({ message: "Usuário ou senha inválidos." });
      }
      if (!env.jwtSecret)
        return response
          .status(503)
          .json({ message: "Autenticação indisponível. Configure JWT_SECRET no servidor." });
      const id = randomUUID();
      const token = jwt.sign({}, env.jwtSecret, {
        algorithm: "HS256",
        jwtid: id,
        subject: String(user.id),
        expiresIn: env.jwtExpiration,
      });
      const session = await sessoesRepository.create(user, {
        id,
        expiraEm: new Date(jwt.decode(token).exp * 1000),
      });
      if (!session) return response.status(401).json({ message: "Usuário ou senha inválidos." });
      response.json({
        token,
        user: { id: user.id, nomeUsuario: user.nomeUsuario, email: user.email },
      });
    } catch (error) {
      next(error);
    }
  },
);
// Rota pública: o próprio usuário pede o link informando o e-mail. A resposta é sempre a
// mesma e o envio acontece depois dela, para não revelar quais e-mails estão cadastrados.
authRoutes.post(
  "/esqueci-senha",
  authRateLimit("forgot", env.authForgotLimit, "email"),
  (request, response, next) => {
    try {
      const { email } = esqueciSenhaSchema.parse(request.body);
      response.json({ message: MENSAGEM_SOLICITACAO });
      senhaService
        .solicitarPorEmail(email, { frontendUrl: env.frontendUrl })
        .catch((error) =>
          console.error("Falha ao enviar o e-mail de redefinição de senha:", error.message),
        );
    } catch (error) {
      next(error);
    }
  },
);
// Rota pública chamada ao abrir a tela do link: responde 204 se ele ainda pode ser usado
// ou 400 se já foi usado, expirou ou é desconhecido. O token vai no corpo, não na URL,
// para não aparecer em registros de acesso.
authRoutes.post(
  "/redefinir-senha/validar",
  authRateLimit("reset-check", env.authResetLimit, "token"),
  async (request, response, next) => {
    try {
      const { token } = validarLinkSchema.parse(request.body);
      await senhaService.validarLink(token);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
// Rota pública: o link chega por e-mail ou é gerado no servidor com
// `corepack pnpm run senha:link <usuário>`.
authRoutes.post(
  "/redefinir-senha",
  authRateLimit("reset", env.authResetLimit, "token"),
  async (request, response, next) => {
    try {
      const { token, novaSenha } = redefinirSenhaSchema.parse(request.body);
      await senhaService.redefinir(token, novaSenha);
      response.json({ message: "Senha redefinida. Entre com a nova senha." });
    } catch (error) {
      next(error);
    }
  },
);
// [ROTA] Devolve o usuário da sessão atual; o front usa para restaurar o login ao recarregar a
// página.
authRoutes.get("/me", authenticate, (request, response) => {
  const { status, ...user } = request.user;
  response.json({ user });
});
// [ROTA][SEGURANCA] Revoga a sessão no banco: o token deixa de valer mesmo antes de vencer.
authRoutes.post("/logout", authenticate, async (request, response, next) => {
  try {
    await sessoesRepository.revoke(request.sessionId, request.user.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
