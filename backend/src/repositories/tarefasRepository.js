/**
 * [REPOSITORY][BANCO][TRANSACAO] Tarefas e sprints, com os responsáveis e as horas registradas de
 * cada tarefa.
 */

import prisma from "../config/prisma.js";
import { HttpError } from "../utils/HttpError.js";

const includeTask = {
  projeto: { select: { nome: true, status: true } },
  sprint: { select: { nome: true, statusRegistro: true } },
  responsaveis: {
    include: { colaborador: { select: { id: true, nomeCompleto: true, status: true } } },
  },
};
const includeSprint = {
  projeto: { select: { nome: true, status: true } },
  _count: { select: { tarefas: true } },
};

async function transaction(operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error.code !== "P2034") throw error;
      if (attempt === 2)
        throw new HttpError(
          409,
          "Os dados foram alterados em outra operação. Atualize e tente novamente.",
        );
    }
  }
}

export const tarefasRepository = {
  // [BANCO] Lista as tarefas com sprint, responsáveis e a soma das horas lançadas
  // (horasRealizadas).
  async findAll({ projetoId, sprintId, busca, status, statusRegistro } = {}) {
    const tasks = await prisma.tarefa.findMany({
      where: {
        ...(projetoId ? { projetoId } : {}),
        ...(sprintId ? { sprintId } : {}),
        ...(busca ? { titulo: { contains: busca, mode: "insensitive" } } : {}),
        ...(status ? { status } : {}),
        ...(statusRegistro ? { statusRegistro } : {}),
      },
      include: includeTask,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    // Agrupar o tempo separado dos responsáveis evita multiplicar horas por pessoa.
    const totals = tasks.length
      ? await prisma.apontamentoHora.groupBy({
          by: ["tarefaId"],
          where: { tarefaId: { in: tasks.map((task) => task.id) } },
          _sum: { horas: true },
        })
      : [];
    const byId = new Map(totals.map((total) => [total.tarefaId, total._sum.horas]));
    return tasks.map((task) => ({ ...task, horasRealizadas: byId.get(task.id) ?? 0 }));
  },
  findById(id, db = prisma) {
    return db.tarefa.findUnique({ where: { id }, include: includeTask });
  },
  // [TRANSACAO] Cria ou edita a tarefa e substitui a lista de responsáveis numa só transação.
  async save(id, data) {
    return transaction(async (tx) => {
      const previous = id
        ? await tx.tarefa.findUnique({ where: { id }, include: { responsaveis: true } })
        : null;
      if (id && !previous) throw new HttpError(404, "Tarefa não encontrada.");
      const merged = { ...previous, ...data };
      if (previous && merged.projetoId !== previous.projetoId)
        throw new HttpError(
          409,
          "O projeto da tarefa não pode ser alterado. Cadastre outra tarefa no projeto desejado.",
        );
      const project = await tx.projeto.findUnique({ where: { id: merged.projetoId } });
      if (!project || project.status !== "ATIVO")
        throw new HttpError(409, "Selecione um projeto ativo para alterar tarefas.");
      if (merged.dataInicio && merged.dataConclusao && merged.dataConclusao < merged.dataInicio)
        throw new HttpError(400, "A conclusão não pode ser anterior ao início.");
      if (merged.dataConclusao && merged.status !== "CONCLUIDA")
        throw new HttpError(400, "Remova a data de conclusão ao reabrir ou cancelar a tarefa.");
      if (merged.sprintId) {
        const sprint = await tx.sprint.findUnique({ where: { id: merged.sprintId } });
        if (!sprint || sprint.projetoId !== merged.projetoId)
          throw new HttpError(400, "A sprint deve pertencer ao mesmo projeto da tarefa.");
        if (sprint.statusRegistro !== "ATIVO" && previous?.sprintId !== merged.sprintId)
          throw new HttpError(409, "Selecione uma sprint ativa.");
      }
      const { responsavelIds, ...fields } = data;
      if (responsavelIds) {
        const existing = new Set(previous?.responsaveis.map((row) => row.colaboradorId) ?? []);
        const added = responsavelIds.filter((colaboradorId) => !existing.has(colaboradorId));
        if (added.length) {
          const eligible = await tx.colaborador.count({
            where: {
              id: { in: added },
              status: "ATIVO",
              projetos: { some: { projetoId: merged.projetoId } },
            },
          });
          if (eligible !== added.length)
            throw new HttpError(
              400,
              "Novos responsáveis devem ser colaboradores ativos vinculados à equipe do projeto.",
            );
        }
      }
      const task = id
        ? await tx.tarefa.update({ where: { id }, data: fields })
        : await tx.tarefa.create({ data: fields });
      if (responsavelIds) {
        await tx.tarefaResponsavel.deleteMany({ where: { tarefaId: task.id } });
        if (responsavelIds.length)
          await tx.tarefaResponsavel.createMany({
            data: responsavelIds.map((colaboradorId) => ({ tarefaId: task.id, colaboradorId })),
          });
      }
      return tx.tarefa.findUnique({ where: { id: task.id }, include: includeTask });
    });
  },
  // [BANCO] Sprints do projeto com a contagem de tarefas.
  listSprints({ projetoId, busca, statusRegistro } = {}) {
    return prisma.sprint.findMany({
      where: {
        ...(projetoId ? { projetoId } : {}),
        ...(busca ? { nome: { contains: busca, mode: "insensitive" } } : {}),
        ...(statusRegistro ? { statusRegistro } : {}),
      },
      include: includeSprint,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  },
  saveSprint(id, data) {
    return transaction(async (tx) => {
      const previous = id ? await tx.sprint.findUnique({ where: { id } }) : null;
      if (id && !previous) throw new HttpError(404, "Sprint não encontrada.");
      const merged = { ...previous, ...data };
      if (previous && merged.projetoId !== previous.projetoId)
        throw new HttpError(409, "O projeto da sprint não pode ser alterado.");
      const project = await tx.projeto.findUnique({ where: { id: merged.projetoId } });
      if (!project || project.status !== "ATIVO")
        throw new HttpError(409, "Selecione um projeto ativo para alterar sprints.");
      if (merged.dataInicio && merged.dataFim && merged.dataFim < merged.dataInicio)
        throw new HttpError(400, "O fim não pode ser anterior ao início.");
      return id
        ? tx.sprint.update({ where: { id }, data, include: includeSprint })
        : tx.sprint.create({ data, include: includeSprint });
    });
  },
};
