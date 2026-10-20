import prisma from "../config/prisma.js";

export const dashboardRepository = {
  async load({ clienteId, equipe, dataInicio, dataFim, projetoId, colaboradorId, sprintId, statusProjeto } = {}) {
    const projetos = await prisma.projeto.findMany({
      where: {
        ...(clienteId ? { clienteId } : {}),
        ...(projetoId ? { id: projetoId } : {}),
        ...(statusProjeto ? { status: statusProjeto } : {}),
        ...(sprintId ? { sprints: { some: { id: sprintId } } } : {}),
        // Equipe continua sendo departamento; incluir também trabalho sem vínculo
        // evita esconder justamente as ocorrências que a auditoria precisa mostrar.
        ...(colaboradorId || equipe ? { AND: [
          ...(colaboradorId ? [{ OR: [
            { equipe: { some: { colaboradorId } } },
            { apontamentos: { some: { colaboradorId } } },
            { tarefas: { some: { responsaveis: { some: { colaboradorId } } } } }
          ] }] : []),
          ...(equipe ? [{ OR: [
            { equipe: { some: { colaborador: { departamento: equipe } } } },
            { apontamentos: { some: { colaborador: { departamento: equipe } } } },
            { tarefas: { some: { responsaveis: { some: { colaborador: { departamento: equipe } } } } } }
          ] }] : [])
        ] } : {})
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        equipe: { orderBy: { dataEntrada: "desc" }, select: {
          id: true, colaboradorId: true, papel: true, dataEntrada: true, dataSaida: true, colaborador: { select: { nomeCompleto: true, cargo: true, departamento: true, status: true } }
        } },
        tarefas: {
          ...(sprintId ? { where: { sprintId } } : {}),
          include: {
            sprint: { select: { id: true, nome: true } },
            responsaveis: { include: { colaborador: { select: { nomeCompleto: true, departamento: true } } } },
            apontamentos: { select: { id: true, data: true, horas: true, colaboradorId: true, colaborador: { select: { departamento: true } } } }
          }, orderBy: { titulo: "asc" }
        },
        apontamentos: {
          where: {
            ...(colaboradorId ? { colaboradorId } : {}),
            ...(sprintId ? { tarefa: { sprintId } } : {}),
            ...(dataInicio || dataFim ? { data: {
              ...(dataInicio ? { gte: dataInicio } : {}),
              ...(dataFim ? { lte: dataFim } : {})
            } } : {}),
            ...(equipe ? { colaborador: { departamento: equipe } } : {})
          },
          include: { colaborador: { select: {
            nomeCompleto: true, cargo: true, departamento: true,
            configuracoesFinanceiras: { include: { itemTabela: true }, orderBy: [{ dataInicio: "desc" }, { id: "desc" }] }
          } } }
        }
      },
      orderBy: { nome: "asc" }
    });
    return projetos;
  },
  findProject(id) { return prisma.projeto.findUnique({ where: { id }, include: { cliente: { select: { nome: true } }, sprints: { orderBy: { dataInicio: "asc" } } } }); },
  findCollaborator(id) { return prisma.colaborador.findUnique({ where: { id }, select: { id: true, nomeCompleto: true, cargo: true, departamento: true, status: true } }); },
  async options() {
    const [clientes, departamentos, projetos, colaboradores] = await Promise.all([
      prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
      prisma.colaborador.findMany({
        where: { OR: [{ projetos: { some: {} } }, { apontamentos: { some: {} } }, { tarefasResponsaveis: { some: {} } }] }, distinct: ["departamento"],
        select: { departamento: true }, orderBy: { departamento: "asc" }
      }),
      prisma.projeto.findMany({ select: { id: true, nome: true, status: true }, orderBy: { nome: "asc" } }),
      prisma.colaborador.findMany({ select: { id: true, nomeCompleto: true, status: true }, orderBy: { nomeCompleto: "asc" } })
    ]);
    return { clientes, equipes: departamentos.map((item) => item.departamento), projetos, colaboradores };
  }
};
