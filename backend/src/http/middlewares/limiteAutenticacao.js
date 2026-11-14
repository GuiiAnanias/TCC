/**
 * [SEGURANCA] Limite de tentativas nas rotas públicas de autenticação (login, esqueci a senha,
 * redefinição). Conta tentativas por origem (IP) e por identificador (login ou e-mail) numa janela
 * de tempo e responde 429 quando passa do limite. No login, o limite por usuário é progressivo
 * (10 s, 1 min, 5 min) e a resposta informa quanto falta para tentar de novo.
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

// Login e e-mail sem diferenciar maiúsculas nem espaços nas pontas; token como veio.
function normalizar(identifierField, raw) {
  const text = typeof raw === "string" && raw.length <= 254 ? raw.trim() : "";
  return ["login", "email"].includes(identifierField) ? text.toLowerCase() : text;
}

// Texto do tempo de espera: "10 segundos", "1 minuto", "4 minutos e 30 segundos".
export function tempoDeEspera(segundos) {
  const plural = (n, palavra) => `${n} ${palavra}${n === 1 ? "" : "s"}`;
  if (segundos < 60) return plural(segundos, "segundo");
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto
    ? `${plural(minutos, "minuto")} e ${plural(resto, "segundo")}`
    : plural(minutos, "minuto");
}

// Cria o middleware para um escopo (ex.: "login") com os limites do env.js. Com bloqueiosMs, o
// limite por identificador é progressivo.
export function limiteAutenticacao(
  scope,
  { originLimit, identifierLimit, windowMs, bloqueiosMs },
  identifierField,
) {
  return async (request, response, next) => {
    try {
      const identifier = normalizar(identifierField, request.body?.[identifierField]);
      // Express não confia em X-Forwarded-For nesta aplicação; usar a origem real.
      const buckets = [["origin", request.ip || request.socket.remoteAddress, originLimit]];
      if (identifier) buckets.push(["identifier", identifier, identifierLimit]);
      for (const [kind, value, limit] of buckets) {
        const chave = key(`${scope}:${kind}`, value);
        const result =
          kind === "identifier" && bloqueiosMs
            ? await limitesAutenticacaoRepository.consumeProgressivo(
                chave,
                limit,
                windowMs,
                bloqueiosMs,
              )
            : await limitesAutenticacaoRepository.consume(chave, limit, windowMs);
        // [ERRO] Passou do limite: 429 com Retry-After e o tempo de espera no corpo, que a tela usa
        // para mostrar a contagem regressiva.
        if (!result.allowed) {
          response.set("Retry-After", String(result.retryAfter));
          return response.status(429).json({
            message: `Muitas tentativas. Tente novamente em ${tempoDeEspera(result.retryAfter)}.`,
            tentarNovamenteEm: result.retryAfter,
          });
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// [SEGURANCA] Depois de um login certo, zera a contagem daquele usuário.
export async function liberarIdentificador(scope, identifierField, raw) {
  const identifier = normalizar(identifierField, raw);
  if (identifier)
    await limitesAutenticacaoRepository.liberar(key(`${scope}:identifier`, identifier));
}
