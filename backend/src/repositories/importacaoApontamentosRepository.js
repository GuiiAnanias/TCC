import prisma from "../config/prisma.js";

export const importacaoApontamentosRepository = {
  // Cadastros usados para reconhecer colaborador, projeto e tarefa de cada linha.
  async cadastros() {
    const [colaboradores, projetos, tarefas, equipes, vigencias] = await Promise.all([
      prisma.colaborador.findMany({
        select: { id: true, nomeCompleto: true, email: true, status: true },
        orderBy: { nomeCompleto: "asc" },
      }),
      prisma.projeto.findMany({
        select: { id: true, nome: true, status: true, cliente: { select: { nome: true } } },
        orderBy: { nome: "asc" },
      }),
      prisma.tarefa.findMany({
        select: {
          id: true,
          projetoId: true,
          titulo: true,
          statusRegistro: true,
          projeto: { select: { status: true } },
        },
        orderBy: { titulo: "asc" },
      }),
      // Participação na equipe e valor/hora vigente: sem eles o custo da hora fica
      // incompleto no dashboard, então a importação avisa antes de gravar.
      prisma.projetoColaborador.findMany({
        select: { projetoId: true, colaboradorId: true, dataEntrada: true, dataSaida: true },
      }),
      prisma.configuracaoFinanceira.findMany({
        select: { colaboradorId: true, dataInicio: true, dataFim: true },
      }),
    ]);
    return { colaboradores, projetos, tarefas, equipes, vigencias };
  },

  // Apontamentos já gravados desses colaboradores nos dias da planilha: servem para o
  // limite de 24 h por dia e para reconhecer uma importação repetida.
  existentes(colaboradorIds, datas, db = prisma) {
    if (!colaboradorIds.length || !datas.length) return [];
    return db.apontamentoHora.findMany({
      where: { colaboradorId: { in: colaboradorIds }, data: { in: datas } },
      select: {
        id: true,
        colaboradorId: true,
        projetoId: true,
        tarefaId: true,
        data: true,
        horas: true,
        descricao: true,
      },
    });
  },

  criar(registros, db = prisma) {
    return db.apontamentoHora.createMany({ data: registros });
  },
};
