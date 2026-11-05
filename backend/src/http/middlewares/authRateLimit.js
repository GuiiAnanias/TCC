import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { limitesAutenticacaoRepository } from "../../repositories/limitesAutenticacaoRepository.js";

const secret = env.jwtSecret || randomBytes(32);
const key = (scope, value) =>
  createHmac("sha256", secret)
    .update(JSON.stringify([scope, value]))
    .digest("hex");

export function authRateLimit(scope, { originLimit, identifierLimit, windowMs }, identifierField) {
  return async (request, response, next) => {
    try {
      const raw = request.body?.[identifierField];
      const text = typeof raw === "string" && raw.length <= 254 ? raw.trim() : "";
      const identifier = identifierField === "login" ? text.toLowerCase() : text;
      // Express não confia em X-Forwarded-For nesta aplicação; usar a origem real.
      const buckets = [["origin", request.ip || request.socket.remoteAddress, originLimit]];
      if (identifier) buckets.push(["identifier", identifier, identifierLimit]);
      for (const [kind, value, limit] of buckets) {
        const result = await limitesAutenticacaoRepository.consume(
          key(`${scope}:${kind}`, value),
          limit,
          windowMs,
        );
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
