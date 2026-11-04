import jwt from "jsonwebtoken";
import { sessoesRepository } from "../../repositories/sessoesRepository.js";
import { env } from "../../config/env.js";

export async function authenticate(request, response, next) {
  const match = request.headers.authorization?.match(/^Bearer (\S+)$/i);
  if (!match) return response.status(401).json({ message: "Faça login para acessar o sistema." });
  let payload;
  try {
    payload = jwt.verify(match[1], env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return response
      .status(401)
      .json({ message: "Sessão inválida ou expirada. Faça login novamente." });
  }
  const id = Number(payload.sub);
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof payload.jti !== "string" ||
    !payload.jti ||
    !Number.isFinite(payload.exp)
  )
    return response.status(401).json({ message: "Sessão inválida." });
  try {
    const session = await sessoesRepository.findById(payload.jti);
    const user = session?.usuario;
    if (
      !session ||
      session.usuarioId !== id ||
      session.revogadaEm ||
      session.expiraEm <= new Date() ||
      !user ||
      user.status !== "ATIVO" ||
      user.versaoSessao !== session.versaoSessao
    )
      return response
        .status(401)
        .json({ message: "Sessão inválida ou expirada. Faça login novamente." });
    request.user = {
      id: user.id,
      nomeUsuario: user.nomeUsuario,
      email: user.email,
      status: user.status,
    };
    request.sessionId = session.id;
    next();
  } catch (error) {
    next(error);
  }
}
