import prisma from "../config/prisma.js";
import { HttpError } from "../utils/HttpError.js";

export const bonificacoesPapeisRepository = {
  findAll() {
    return prisma.bonificacaoPapel.findMany({
      orderBy: [{ papel: "asc" }, { dataInicio: "desc" }],
    });
  },
  createVersion(data) {
    return prisma.$transaction(
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
  },
};
