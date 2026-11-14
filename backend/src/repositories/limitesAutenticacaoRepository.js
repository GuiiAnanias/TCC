/**
 * [REPOSITORY][BANCO][SEGURANCA] Contador de tentativas de login e de recuperação de senha (usado
 * pelo middleware limiteAutenticacao).
 */

import prisma from "../config/prisma.js";

let proximaLimpeza = 0;
export const limitesAutenticacaoRepository = {
  // [SEGURANCA][BANCO] Soma uma tentativa com um UPSERT atômico no PostgreSQL e diz se ainda está
  // dentro do limite.
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

  // [SEGURANCA][BANCO] Bloqueio progressivo (login por usuário): passou do limite dentro da janela,
  // bloqueia pelo primeiro tempo da lista (10 s); cada nova tentativa depois que o bloqueio acaba
  // sobe para o próximo (1 min, 5 min) até o último. Tentativas durante o bloqueio são recusadas sem
  // prorrogá-lo. A contagem esquece o histórico depois de uma janela inteira sem bloqueio.
  // A linha fica travada (FOR UPDATE) durante a conta, então requisições simultâneas não escapam.
  async consumeProgressivo(chave, limite, janelaMs, bloqueiosMs, db = prisma) {
    const resultado = await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO limites_autenticacao (chave, tentativas, "expiraEm")
        VALUES (${chave}, 0, CURRENT_TIMESTAMP + ${janelaMs} * interval '1 millisecond')
        ON CONFLICT (chave) DO NOTHING`;
      const [linha] = await tx.$queryRaw`
        SELECT tentativas, nivel,
          COALESCE("bloqueadoAte" > CURRENT_TIMESTAMP, false) AS bloqueado,
          "expiraEm" <= CURRENT_TIMESTAMP AS expirada,
          EXTRACT(EPOCH FROM ("bloqueadoAte" - CURRENT_TIMESTAMP))::float8 AS restante
        FROM limites_autenticacao WHERE chave = ${chave} FOR UPDATE`;
      if (linha.bloqueado)
        return { allowed: false, retryAfter: Math.max(1, Math.ceil(linha.restante)) };

      const tentativas = (linha.expirada ? 0 : linha.tentativas) + 1;
      const bloquear = tentativas > limite;
      const nivel = (linha.expirada ? 0 : linha.nivel) + (bloquear ? 1 : 0);
      const duracaoMs = bloquear ? bloqueiosMs[Math.min(nivel, bloqueiosMs.length) - 1] : 0;
      // Durante e logo depois do bloqueio a linha continua valendo por mais uma janela, para que
      // um novo erro suba de nível em vez de recomeçar a contagem.
      await tx.$executeRaw`
        UPDATE limites_autenticacao SET
          tentativas = ${tentativas},
          nivel = ${nivel},
          "bloqueadoAte" = CASE WHEN ${bloquear}
            THEN CURRENT_TIMESTAMP + ${duracaoMs} * interval '1 millisecond' ELSE NULL END,
          "expiraEm" = CASE
            WHEN ${bloquear} THEN CURRENT_TIMESTAMP + ${duracaoMs + janelaMs} * interval '1 millisecond'
            WHEN ${linha.expirada} THEN CURRENT_TIMESTAMP + ${janelaMs} * interval '1 millisecond'
            ELSE "expiraEm" END
        WHERE chave = ${chave}`;
      return bloquear
        ? { allowed: false, retryAfter: Math.ceil(duracaoMs / 1000) }
        : { allowed: true, retryAfter: 0 };
    });
    if (Date.now() >= proximaLimpeza) {
      proximaLimpeza = Date.now() + 60000;
      await db.$executeRaw`DELETE FROM limites_autenticacao WHERE "expiraEm" < CURRENT_TIMESTAMP`;
    }
    return resultado;
  },

  // [SEGURANCA][BANCO] Login certo: zera a contagem daquele usuário.
  async liberar(chave, db = prisma) {
    await db.limiteAutenticacao.deleteMany({ where: { chave } });
  },
};
