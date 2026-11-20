import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

// Sessão explícita para fixtures das integrações; tokens legados continuam inválidos.
export async function createTestSession(client, user, secret) {
  const id = randomUUID();
  const token = jwt.sign({}, secret, { subject: String(user.id), jwtid: id, expiresIn: "5m" });
  await client.sessao.create({
    data: {
      id,
      usuarioId: user.id,
      versaoSessao: user.versaoSessao,
      expiraEm: new Date(jwt.decode(token).exp * 1000),
    },
  });
  return token;
}
