import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { authenticate } from "../middlewares/authenticate.js";
import { senhaService } from "../../services/senhaService.js";
import { sessoesRepository } from "../../repositories/sessoesRepository.js";
import { novaSenhaSchema } from "../../schemas/senhaSchemas.js";
import { authRateLimit } from "../middlewares/authRateLimit.js";

const dummyHash = bcrypt.hashSync("credencial-ficticia-para-comparacao", 10);

export const authRoutes = Router();
const loginSchema = z.object({
  login: z.string().trim().min(1).max(254),
  senha: z.string().min(1).max(256),
});
const redefinirSenhaSchema = z.object({
  token: z
    .string({ message: "Link inválido." })
    .trim()
    .min(20, "Link inválido.")
    .max(200, "Link inválido."),
  novaSenha: novaSenhaSchema,
});

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
// Rota pública: o link é gerado no servidor com `corepack pnpm run senha:link <usuário>`.
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
authRoutes.get("/me", authenticate, (request, response) => {
  const { status, ...user } = request.user;
  response.json({ user });
});
authRoutes.post("/logout", authenticate, async (request, response, next) => {
  try {
    await sessoesRepository.revoke(request.sessionId, request.user.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
