import prisma from "../config/prisma.js";

export const dashboardRepository = {
  async load({
    clienteId,
    equipe,
    dataInicio,
    dataFim,
    projetoId,
    projetoIds,
    colaboradorId,
    sprintId,
    statusProjeto,
  } = {}) {
    const ids = projetoIds?.length ? projetoIds : projetoId ? [projetoId] : [];
    const projetos = await prisma.projeto.findMany({
      where: {
        ...(clienteId ? { clienteId } : {}),
        ...(ids.length ? { id: { in: ids } } : {}),
        ...(statusProjeto ? { status: statusProjeto } : {}),
        ...(sprintId ? { sprints: { some: { id: sprintId } } } : {}),
        // Equipe continua sendo departamento; incluir também trabalho sem vínculo
        // evita esconder justamente as ocorrências que a auditoria precisa mostrar.
        ...(colaboradorId || equipe
          ? {
              AND: [
                ...(colaboradorId
                  ? [
                      {
                        OR: [
                          { equipe: { some: { colaboradorId } } },
                          { apontamentos: { some: { colaboradorId } } },
                          { tarefas: { some: { responsaveis: { some: { colaboradorId } } } } },
                        ],
                      },
                    ]
                  : []),
                ...(equipe
                  ? [
                      {
                        OR: [
                          { equipe: { some: { colaborador: { departamento: equipe } } } },
                          { apontamentos: { some: { colaborador: { departamento: equipe } } } },
                          {
                            tarefas: {
                              some: {
                                responsaveis: { some: { colaborador: { departamento: equipe } } },
                              },
                            },
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        equipe: {
          orderBy: { dataEntrada: "desc" },
          select: {
            id: true,
            colaboradorId: true,
            papel: true,
            dataEntrada: true,
            dataSaida: true,
            colaborador: {
              select: { nomeCompleto: true, cargo: true, departamento: true, status: true },
            },
          },
        },
        tarefas: {
          ...(sprintId ? { where: { sprintId } } : {}),
          include: {
            sprint: { select: { id: true, nome: true } },
            responsaveis: {
              include: { colaborador: { select: { nomeCompleto: true, departamento: true } } },
            },
            apontamentos: {
              select: {
                id: true,
                data: true,
                horas: true,
                colaboradorId: true,
                colaborador: { select: { departamento: true } },
              },
            },
          },
          orderBy: { titulo: "asc" },
        },
        apontamentos: {
          where: {
            ...(colaboradorId ? { colaboradorId } : {}),
            ...(sprintId ? { tarefa: { sprintId } } : {}),
            ...(dataInicio || dataFim
              ? {
                  data: {
                    ...(dataInicio ? { gte: dataInicio } : {}),
                    ...(dataFim ? { lte: dataFim } : {}),
                  },
                }
              : {}),
            ...(equipe ? { colaborador: { departamento: equipe } } : {}),
          },
          include: {
            colaborador: {
              select: {
                nomeCompleto: true,
                email: true,
                cargo: true,
                departamento: true,
                configuracoesFinanceiras: {
                  include: { itemTabela: true },
                  orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
                },
              },
            },
          },
        },
      },
      orderBy: { nome: "asc" },
    });
    return projetos;
  },
  findProject(id) {
    return prisma.projeto.findUnique({
      where: { id },
      include: { cliente: { select: { nome: true } }, sprints: { orderBy: { dataInicio: "asc" } } },
    });
  },
  findSprint(id) {
    return prisma.sprint.findUnique({
      where: { id },
      select: { id: true, nome: true, projetoId: true },
    });
  },
  // Nomes dos filtros por id, para identificar o recorte no relatório exportado.
  async filterNames({ clienteId, projetoId, projetoIds, colaboradorId, sprintId } = {}) {
    const ids = projetoIds?.length ? projetoIds : projetoId ? [projetoId] : [];
    const [cliente, projetos, colaborador, sprint] = await Promise.all([
      clienteId
        ? prisma.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } })
        : null,
      ids.length
        ? prisma.projeto.findMany({
            where: { id: { in: ids } },
            select: { nome: true },
            orderBy: { nome: "asc" },
          })
        : [],
      colaboradorId
        ? prisma.colaborador.findUnique({
            where: { id: colaboradorId },
            select: { nomeCompleto: true },
          })
        : null,
      sprintId
        ? prisma.sprint.findUnique({ where: { id: sprintId }, select: { nome: true } })
        : null,
    ]);
    return {
      cliente: cliente?.nome ?? null,
      projetos: projetos.map((item) => item.nome),
      colaborador: colaborador?.nomeCompleto ?? null,
      sprint: sprint?.nome ?? null,
    };
  },
  findCollaborator(id) {
    return prisma.colaborador.findUnique({
      where: { id },
      select: { id: true, nomeCompleto: true, cargo: true, departamento: true, status: true },
    });
  },
  async options() {
    const [clientes, departamentos, projetos, colaboradores, sprints] = await Promise.all([
      prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
      prisma.colaborador.findMany({
        where: {
          OR: [
            { projetos: { some: {} } },
            { apontamentos: { some: {} } },
            { tarefasResponsaveis: { some: {} } },
          ],
        },
        distinct: ["departamento"],
        select: { departamento: true },
        orderBy: { departamento: "asc" },
      }),
      prisma.projeto.findMany({
        select: { id: true, nome: true, status: true, clienteId: true },
        orderBy: { nome: "asc" },
      }),
      prisma.colaborador.findMany({
        select: { id: true, nomeCompleto: true, status: true },
        orderBy: { nomeCompleto: "asc" },
      }),
      // A sprint só faz sentido junto do projeto dela: a tela mostra as do projeto escolhido.
      prisma.sprint.findMany({
        select: { id: true, nome: true, projetoId: true, statusRegistro: true },
        orderBy: [{ dataInicio: "asc" }, { id: "asc" }],
      }),
    ]);
    return {
      clientes,
      equipes: departamentos.map((item) => item.departamento),
      projetos,
      colaboradores,
      sprints,
    };
  },
};
