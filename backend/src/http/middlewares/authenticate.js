import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";

export async function authenticate(request, response, next) {
  const match = request.headers.authorization?.match(/^Bearer (\S+)$/i);
  if (!match) return response.status(401).json({ message: "Faça login para acessar o sistema." });
  let payload;
  try {
    payload = jwt.verify(match[1], env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return response.status(401).json({ message: "Sessão inválida ou expirada. Faça login novamente." });
  }
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id <= 0) return response.status(401).json({ message: "Sessão inválida." });
  try {
    const user = await prisma.usuario.findUnique({ where: { id }, select: { id: true, nomeUsuario: true, email: true, status: true } });
    if (!user || user.status !== "ATIVO") return response.status(401).json({ message: "Sessão inválida." });
    request.user = user;
    next();
  } catch (error) { next(error); }
}
