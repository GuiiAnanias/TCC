/**
 * [SEGURANCA] Limite de tentativas nas rotas públicas de autenticação (login, esqueci a senha,
 * redefinição). Conta tentativas por origem (IP) e por identificador (login ou e-mail) numa janela
 * de tempo e responde 429 quando passa do limite.
 */

import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { limitesAutenticacaoRepository } from "../../repositories/limitesAutenticacaoRepository.js";

const secret = env.jwtSecret || randomBytes(32);
// [SEGURANCA] A chave gravada no banco é um HMAC: o banco não guarda IP nem e-mail em texto puro.
const key = (scope, value) =>
  createHmac("sha256", secret)
    .update(JSON.stringify([scope, value]))
    .digest("hex");

// Cria o middleware para um escopo (ex.: "login") com os limites do env.js.
export function authRateLimit(scope, { originLimit, identifierLimit, windowMs }, identifierField) {
  return async (request, response, next) => {
    try {
      const raw = request.body?.[identifierField];
      const text = typeof raw === "string" && raw.length <= 254 ? raw.trim() : "";
      const identifier = ["login", "email"].includes(identifierField) ? text.toLowerCase() : text;
      // Express não confia em X-Forwarded-For nesta aplicação; usar a origem real.
      const buckets = [["origin", request.ip || request.socket.remoteAddress, originLimit]];
      if (identifier) buckets.push(["identifier", identifier, identifierLimit]);
      for (const [kind, value, limit] of buckets) {
        const result = await limitesAutenticacaoRepository.consume(
          key(`${scope}:${kind}`, value),
          limit,
          windowMs,
        );
        // [ERRO] Passou do limite: 429 com Retry-After (segundos para tentar de novo).
        if (!result.allowed) {
          response.set("Retry-After", String(result.retryAfter));
          return response
            .status(429)
            .json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
