import "dotenv/config";

const positiveInteger = (name, fallback) => {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 86400000)
    throw new Error(`Configuração inválida: ${name}.`);
  return value;
};

export const env = {
  port: Number(process.env.PORT || 3333),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || "1d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  authLoginLimit: {
    originLimit: positiveInteger("AUTH_LOGIN_ORIGIN_LIMIT", 60),
    identifierLimit: positiveInteger("AUTH_LOGIN_IDENTIFIER_LIMIT", 10),
    windowMs: positiveInteger("AUTH_LOGIN_WINDOW_MS", 15 * 60 * 1000),
  },
  authResetLimit: {
    originLimit: positiveInteger("AUTH_RESET_ORIGIN_LIMIT", 20),
    identifierLimit: positiveInteger("AUTH_RESET_IDENTIFIER_LIMIT", 10),
    windowMs: positiveInteger("AUTH_RESET_WINDOW_MS", 15 * 60 * 1000),
  },
};
