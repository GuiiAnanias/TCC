import prisma from "../config/prisma.js";

let proximaLimpeza = 0;
export const limitesAutenticacaoRepository = {
  async consume(chave, limite, janelaMs, db = prisma) {
    // UPSERT atômico: processos/requisições concorrentes compartilham o limite.
    // Tentativas recusadas não prorrogam o bloqueio.
    const [bucket] = await db.$queryRaw`
      INSERT INTO limites_autenticacao (chave, tentativas, "expiraEm")
      VALUES (${chave}, 1, CURRENT_TIMESTAMP + ${janelaMs} * interval '1 millisecond')
      ON CONFLICT (chave) DO UPDATE SET
        tentativas = CASE WHEN limites_autenticacao."expiraEm" <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST(limites_autenticacao.tentativas + 1, ${limite + 1}) END,
        "expiraEm" = CASE WHEN limites_autenticacao."expiraEm" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + ${janelaMs} * interval '1 millisecond'
          ELSE limites_autenticacao."expiraEm" END
      RETURNING tentativas, "expiraEm", CURRENT_TIMESTAMP AS agora`;
    if (Date.now() >= proximaLimpeza) {
      proximaLimpeza = Date.now() + 60000;
      await db.limiteAutenticacao.deleteMany({ where: { expiraEm: { lt: bucket.agora } } });
    }
    return {
      allowed: bucket.tentativas <= limite,
      retryAfter: Math.max(1, Math.ceil((bucket.expiraEm - bucket.agora) / 1000)),
    };
  },
};
