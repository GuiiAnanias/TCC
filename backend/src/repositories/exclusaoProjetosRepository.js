import prisma from "../config/prisma.js";
import { HttpError } from "../utils/HttpError.js";

const blockedMessage =
  "Este projeto possui vínculos ou histórico e não pode ser excluído. Use a alteração de estado para preservá-lo.";

export const exclusaoProjetosRepository = {
  async inspect(id, db = prisma) {
    const project = await db.projeto.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        _count: {
          select: {
            equipe: true,
            tarefas: true,
            sprints: true,
            apontamentos: true,
            avaliacoes: true,
            relatorios: true,
          },
        },
      },
    });
    if (!project) throw new HttpError(404, "Projeto não encontrado.");
    return {
      id: project.id,
      nome: project.nome,
      podeExcluir: Object.values(project._count).every((count) => count === 0),
      vinculos: project._count,
    };
  },
  async remove(id) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(
          async (db) => {
            // As FKs das operações concorrentes disputam este mesmo registro.
            await db.$queryRaw`SELECT id FROM projetos WHERE id = ${id} FOR UPDATE`;
            const project = await exclusaoProjetosRepository.inspect(id, db);
            if (!project.podeExcluir) throw new HttpError(409, blockedMessage, project.vinculos);
            await db.projeto.delete({ where: { id } });
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        if (error.code === "P2003") throw new HttpError(409, blockedMessage);
        if (error.code !== "P2034") throw error;
        if (attempt === 2)
          throw new HttpError(
            409,
            "O projeto mudou em outra operação. Confira os vínculos e tente novamente.",
          );
      }
    }
  },
};
