/**
 * [CONFIG] Lê as variáveis de ambiente do .env (porta, segredo do JWT, endereço do front, SMTP e
 * limites de tentativas de login). Copie .env.example para .env para configurar.
 */

import "dotenv/config";

// [VALIDACAO] Número inteiro positivo vindo do .env; valor inválido impede a API de subir, em vez
// de rodar com limite errado.
const positiveInteger = (name, fallback) => {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 86400000)
    throw new Error(`Configuração inválida: ${name}.`);
  return value;
};

// Configuração usada pelo resto do backend (import { env } from "../config/env.js").
export const env = {
  port: Number(process.env.PORT || 3333),
  nodeEnv: process.env.NODE_ENV || "development",
  // [SEGURANCA] Segredo que assina os tokens de sessão (JWT_SECRET). Nunca versionar o .env.
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || "1d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  // [SEGURANCA] Limites de tentativas de login por origem (IP) e por usuário, dentro de uma janela
  // de tempo.
  authLoginLimit: {
    originLimit: positiveInteger("AUTH_LOGIN_ORIGIN_LIMIT", 60),
    identifierLimit: positiveInteger("AUTH_LOGIN_IDENTIFIER_LIMIT", 10),
    windowMs: positiveInteger("AUTH_LOGIN_WINDOW_MS", 15 * 60 * 1000),
  },
  // Envio de e-mail. O padrão aponta para o Mailpit do docker-compose (sem autenticação).
  mail: {
    host: process.env.SMTP_HOST || "localhost",
    port: positiveInteger("SMTP_PORT", 1025),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "CODE BI <nao-responda@codebi.local>",
  },
  authForgotLimit: {
    originLimit: positiveInteger("AUTH_FORGOT_ORIGIN_LIMIT", 20),
    identifierLimit: positiveInteger("AUTH_FORGOT_IDENTIFIER_LIMIT", 5),
    windowMs: positiveInteger("AUTH_FORGOT_WINDOW_MS", 15 * 60 * 1000),
  },
  authResetLimit: {
    originLimit: positiveInteger("AUTH_RESET_ORIGIN_LIMIT", 20),
    identifierLimit: positiveInteger("AUTH_RESET_IDENTIFIER_LIMIT", 10),
    windowMs: positiveInteger("AUTH_RESET_WINDOW_MS", 15 * 60 * 1000),
  },
};
