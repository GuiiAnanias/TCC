/**
 * [REPOSITORY][BANCO] Dados da importação de horas: cadastros para reconhecer cada linha,
 * apontamentos já gravados (duplicidade) e o histórico de importações.
 */

import prisma from "../config/prisma.js";
import { projetosRepository } from "./projetosRepository.js";
import { ErroHttp } from "../utils/ErroHttp.js";
import { financeDate } from "../utils/datasFinanceiras.js";

export const importacaoApontamentosRepository = {
  // Cadastros usados para reconhecer colaborador, projeto e tarefa de cada linha.
  async cadastros(db = prisma) {
    const [colaboradores, projetos, tarefas, equipes, vigencias] = await Promise.all([
      db.colaborador.findMany({
        select: { id: true, nomeCompleto: true, email: true, status: true },
        orderBy: { nomeCompleto: "asc" },
      }),
      db.projeto.findMany({
        select: { id: true, nome: true, status: true, cliente: { select: { nome: true } } },
        orderBy: { nome: "asc" },
      }),
      db.tarefa.findMany({
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
      db.projetoColaborador.findMany({
        select: { projetoId: true, colaboradorId: true, dataEntrada: true, dataSaida: true },
      }),
      db.configuracaoFinanceira.findMany({
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

  // Histórico: uma linha por tentativa de importação. Quando a importação dá certo, é
  // gravada na mesma transação dos apontamentos; quando falha, depois do rollback.
  registrar(dados, db = prisma) {
    return db.importacaoApontamentos.create({ data: dados, select: { id: true } });
  },

  // [BANCO] Histórico paginado, da importação mais recente para a mais antiga.
  async historico({ pagina, porPagina }, db = prisma) {
    const [total, itens] = await Promise.all([
      db.importacaoApontamentos.count(),
      db.importacaoApontamentos.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: { usuario: { select: { id: true, nomeUsuario: true } } },
      }),
    ]);
    return { total, itens };
  },

  // [BANCO] Grava todos os apontamentos da planilha (chamado dentro da transação da importação).
  async criar(registros, db = prisma) {
    const pessoas = [...new Set(registros.map((item) => item.colaboradorId))].sort((a, b) => a - b);
    const projetos = [...new Set(registros.map((item) => item.projetoId))].sort((a, b) => a - b);
    for (const id of pessoas)
      await db.$queryRaw`SELECT id FROM colaboradores WHERE id = ${id} FOR SHARE`;
    for (const id of projetos)
      await db.$queryRaw`SELECT id FROM projetos WHERE id = ${id} FOR SHARE`;
    for (const record of registros) {
      if (
        !(await projetosRepository.hasOperationalTeam(
          record.projetoId,
          financeDate(record.data),
          db,
        ))
      )
        throw new ErroHttp(
          409,
          "Vincule uma equipe válida na data das horas antes de importar apontamentos.",
        );
    }
    return db.apontamentoHora.createMany({ data: registros });
  },
};
