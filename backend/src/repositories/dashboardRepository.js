/**
 * [REPOSITORY][BANCO] Carrega do banco tudo o que o dashboard precisa (projetos, equipes,
 * vigências, apontamentos, tarefas) e as opções dos filtros. Os cálculos ficam em
 * services/dashboardService.js.
 */

import prisma from "../config/prisma.js";

// Projetos por consulta ao completar as tarefas.
const PROJETOS_POR_CONSULTA = 200;

/**
 * [BANCO] Preenche tarefa.sprint, tarefa.responsaveis e tarefa.apontamentos (todas as horas da
 * tarefa, sem o recorte de período) com consultas simples por bloco de projetos.
 * Tarefa se liga à sprint e às horas por chave composta (id + projetoId); pelo include, o Prisma
 * montava uma condição com cada par e, com dezenas de milhares de tarefas, o PostgreSQL recusava
 * a consulta (stack depth limit exceeded). Como os ids já são únicos, basta agrupar por eles.
 * Os dados do colaborador vêm de uma consulta só e são compartilhados, em vez de repetidos em
 * cada linha.
 */
async function completarTarefas(projetos, horasDoProjetoCompletas) {
  const comTarefas = projetos.filter((projeto) => projeto.tarefas?.length);
  if (!comTarefas.length) return;
  // Sem recorte nas horas, o projeto já trouxe todas elas: não é preciso buscar de novo.
  const horasJaCarregadas = (projetoIds) =>
    projetos
      .filter((projeto) => projetoIds.in.includes(projeto.id))
      .flatMap((projeto) => projeto.apontamentos)
      .filter((apontamento) => apontamento.tarefaId !== null)
      .map(({ id, tarefaId, data, horas, colaboradorId }) => ({
        id,
        tarefaId,
        data,
        horas,
        colaboradorId,
      }));
  const sprints = new Map();
  const responsaveisPorTarefa = new Map();
  const horasPorTarefa = new Map();
  const agrupar = (mapa, chave, item) => {
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(item);
  };
  const pessoas = new Map(
    (
      await prisma.colaborador.findMany({
        select: { id: true, nomeCompleto: true, departamento: true },
      })
    ).map(({ id, ...pessoa }) => [id, pessoa]),
  );
  for (let inicio = 0; inicio < comTarefas.length; inicio += PROJETOS_POR_CONSULTA) {
    const projetoId = {
      in: comTarefas.slice(inicio, inicio + PROJETOS_POR_CONSULTA).map((p) => p.id),
    };
    const [blocoSprints, responsaveis, horas] = await Promise.all([
      prisma.sprint.findMany({ where: { projetoId }, select: { id: true, nome: true } }),
      prisma.tarefaResponsavel.findMany({ where: { tarefa: { projetoId } } }),
      horasDoProjetoCompletas
        ? horasJaCarregadas(projetoId)
        : prisma.apontamentoHora.findMany({
            where: { projetoId, tarefaId: { not: null } },
            select: { id: true, tarefaId: true, data: true, horas: true, colaboradorId: true },
          }),
    ]);
    for (const sprint of blocoSprints) sprints.set(sprint.id, sprint);
    for (const responsavel of responsaveis)
      agrupar(responsaveisPorTarefa, responsavel.tarefaId, {
        ...responsavel,
        colaborador: pessoas.get(responsavel.colaboradorId),
      });
    for (const { tarefaId, ...apontamento } of horas)
      agrupar(horasPorTarefa, tarefaId, {
        ...apontamento,
        colaborador: { departamento: pessoas.get(apontamento.colaboradorId)?.departamento },
      });
  }
  for (const projeto of comTarefas)
    for (const tarefa of projeto.tarefas) {
      tarefa.sprint = tarefa.sprintId ? (sprints.get(tarefa.sprintId) ?? null) : null;
      tarefa.responsaveis = responsaveisPorTarefa.get(tarefa.id) ?? [];
      tarefa.apontamentos = horasPorTarefa.get(tarefa.id) ?? [];
    }
}

/**
 * [BANCO] Preenche apontamento.colaborador (dados e histórico financeiro para o custo) com uma
 * consulta só. Os apontamentos do mesmo colaborador compartilham o mesmo objeto.
 */
async function completarColaboradores(projetos) {
  const ids = [
    ...new Set(
      projetos.flatMap((projeto) => (projeto.apontamentos ?? []).map((a) => a.colaboradorId)),
    ),
  ];
  if (!ids.length) return;
  const colaboradores = await prisma.colaborador.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      cargo: true,
      departamento: true,
      configuracoesFinanceiras: {
        include: { itemTabela: true },
        orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
      },
    },
  });
  const porId = new Map(colaboradores.map(({ id, ...colaborador }) => [id, colaborador]));
  for (const projeto of projetos)
    for (const apontamento of projeto.apontamentos ?? [])
      apontamento.colaborador = porId.get(apontamento.colaboradorId);
}

export const dashboardRepository = {
  // [BANCO] Projetos do recorte e seus relacionamentos. Sem descricoes, os apontamentos vêm sem
  // a descrição (o Dashboard Geral não a mostra e ela pode ter milhares de caracteres).
  async load(
    {
      clienteId,
      equipe,
      dataInicio,
      dataFim,
      projetoId,
      projetoIds,
      colaboradorId,
      sprintId,
      statusProjeto,
      statusApontamentos,
    } = {},
    { descricoes = true } = {},
  ) {
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
          // Sprint, responsáveis e horas de cada tarefa vêm em seguida, em completarTarefas.
          select: {
            id: true,
            projetoId: true,
            sprintId: true,
            titulo: true,
            status: true,
            statusRegistro: true,
            minutosEstimados: true,
            correcao: true,
            dataInicio: true,
            dataConclusao: true,
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
            // Só usado pelos relatórios (ex.: apenas horas aprovadas e faturadas).
            ...(statusApontamentos?.length ? { status: { in: statusApontamentos } } : {}),
          },
          // O colaborador (com o histórico financeiro) é buscado uma vez só, em
          // completarColaboradores, em vez de vir repetido em cada apontamento.
          select: {
            id: true,
            colaboradorId: true,
            projetoId: true,
            tarefaId: true,
            data: true,
            horas: true,
            status: true,
            descricao: descricoes,
            custoConsolidado: true,
          },
        },
      },
      orderBy: { nome: "asc" },
    });
    const horasSemRecorte =
      !colaboradorId &&
      !sprintId &&
      !dataInicio &&
      !dataFim &&
      !equipe &&
      !statusApontamentos?.length;
    await Promise.all([
      completarTarefas(projetos, horasSemRecorte),
      completarColaboradores(projetos),
    ]);
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
  // Nomes dos filtros escolhidos, para as etiquetas do recorte na tela e no Excel.
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
  // [BANCO] Listas dos filtros: clientes, projetos, colaboradores, sprints e equipes.
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
