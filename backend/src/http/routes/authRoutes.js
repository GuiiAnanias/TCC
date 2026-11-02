import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { authenticate } from "../middlewares/authenticate.js";
import { senhaService } from "../../services/senhaService.js";

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
  novaSenha: z
    .string({ message: "Informe a nova senha." })
    .min(8, "A nova senha precisa ter pelo menos 8 caracteres.")
    .max(256, "A nova senha pode ter no máximo 256 caracteres."),
});

authRoutes.post("/login", async (request, response, next) => {
  try {
    const { login, senha } = loginSchema.parse(request.body);
    const user = await prisma.usuario.findFirst({
      where: { OR: [{ email: login }, { nomeUsuario: login }] },
    });
    if (!user || !(await bcrypt.compare(senha, user.senhaHash)) || user.status !== "ATIVO") {
      return response.status(401).json({ message: "Usuário ou senha inválidos." });
    }
    if (!env.jwtSecret)
      return response
        .status(503)
        .json({ message: "Autenticação indisponível. Configure JWT_SECRET no servidor." });
    const token = jwt.sign({}, env.jwtSecret, {
      algorithm: "HS256",
      subject: String(user.id),
      expiresIn: env.jwtExpiration,
    });
    response.json({
      token,
      user: { id: user.id, nomeUsuario: user.nomeUsuario, email: user.email },
    });
  } catch (error) {
    next(error);
  }
});
// Rota pública: o link é gerado no servidor com `corepack pnpm run senha:link <usuário>`.
authRoutes.post("/redefinir-senha", async (request, response, next) => {
  try {
    const { token, novaSenha } = redefinirSenhaSchema.parse(request.body);
    await senhaService.redefinir(token, novaSenha);
    response.json({ message: "Senha redefinida. Entre com a nova senha." });
  } catch (error) {
    next(error);
  }
});
authRoutes.get("/me", authenticate, (request, response) => {
  const { status, ...user } = request.user;
  response.json({ user });
});
