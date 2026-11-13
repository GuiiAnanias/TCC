/**
 * [REPOSITORY][BANCO] Regras de bonificação por papel. Cada regra nova encerra a anterior do mesmo
 * papel; regras não são editadas nem apagadas.
 */

import prisma from "../config/prisma.js";
import { custoConflict } from "../utils/custoConflict.js";
import { HttpError } from "../utils/HttpError.js";

export const bonificacoesPapeisRepository = {
  findAll() {
    return prisma.bonificacaoPapel.findMany({
      orderBy: [{ papel: "asc" }, { dataInicio: "desc" }],
    });
  },
  // [TRANSACAO][REGRA] Grava a nova regra e encerra a vigente do mesmo papel; o início precisa ser
  // depois da regra aberta. Mudança que alteraria custo já faturado é barrada pelo gatilho do
  // banco.
  async createVersion(data) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const current = await tx.bonificacaoPapel.findFirst({
              where: { papel: data.papel, dataFim: null },
            });
            if (current && data.dataInicio <= current.dataInicio) {
              throw new HttpError(
                400,
                "A nova vigência deve começar após a configuração anterior. O histórico é preservado.",
              );
            }
            if (current)
              await tx.bonificacaoPapel.update({
                where: { id: current.id },
                data: { dataFim: data.dataInicio },
              });
            return tx.bonificacaoPapel.create({ data });
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        const conflict = custoConflict(error);
        if (conflict) throw conflict;
        if (error.code !== "P2034") throw error;
        if (attempt === 2)
          throw new HttpError(
            409,
            "A bonificação foi alterada em outra operação. Atualize e tente novamente.",
          );
      }
    }
  },
};
