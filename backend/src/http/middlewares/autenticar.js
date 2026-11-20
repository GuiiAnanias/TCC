/**
 * [SEGURANCA] Middleware de autenticação. Roda antes de todas as rotas protegidas (ver
 * routes.use(autenticar) em http/routes/index.js). Sem token válido e sessão ativa no banco,
 * responde 401.
 */

import jwt from "jsonwebtoken";
import { sessoesRepository } from "../../repositories/sessoesRepository.js";
import { env } from "../../config/env.js";

// [SEGURANCA] Confere o cabeçalho Authorization: Bearer <token>, a assinatura e a validade do JWT e
// a sessão gravada no banco.
export async function autenticar(request, response, next) {
  // [SEGURANCA] Sem o cabeçalho no formato Bearer: 401.
  const match = request.headers.authorization?.match(/^Bearer (\S+)$/i);
  if (!match) return response.status(401).json({ message: "Faça login para acessar o sistema." });
  let payload;
  try {
    // [SEGURANCA] Assinatura e expiração do token; só aceita HS256.
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
    // [SEGURANCA] A sessão precisa existir, não estar revogada (logout) nem vencida, e o usuário
    // precisa estar ativo. Por isso o Sair encerra o token de verdade.
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
    // Usuário logado fica disponível para as próximas etapas em request.user.
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
