/**
 * [REPOSITORY][BANCO][TRANSACAO] Regras e avaliações de premiação. Monta a base de conferência
 * (projetos, tarefas e indicadores) e grava rascunho, conclusão e reavaliação.
 */

import prisma from "../config/prisma.js";
import { ErroHttp } from "../utils/ErroHttp.js";
import {
  NOME_CATEGORIA,
  calculateAward,
  categoriaDoPapel,
  premiacaoTemplates,
} from "../services/regrasPremiacao.js";
import { operationalIndicators } from "../services/indicadoresOperacionais.js";

const relations = {
  regra: true,
  criadoPor: { select: { nomeUsuario: true } },
  concluidoPor: { select: { nomeUsuario: true } },
  proxima: { select: { id: true, versao: true, status: true } },
};
const json = (value) => JSON.parse(JSON.stringify(value));
// [TRANSACAO] Transação Serializable com novas tentativas em conflito.
async function transaction(operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        timeout: 30000,
      });
    } catch (error) {
      if (error.code !== "P2034") throw error;
      if (attempt === 2)
        throw new ErroHttp(409, "A avaliação mudou em outra operação. Atualize a tela.");
    }
  }
}

// [REGRA] Monta a cópia da base de conferência da avaliação no momento do salvamento.
export async function buildAwardContent(tx, identity, rule, dados, actor) {
  const known = new Set(rule.definicao.criterios.map((row) => row.chave));
  if (dados.respostas.some((row) => !known.has(row.chave)))
    throw new ErroHttp(400, "Resposta não pertence à versão das regras selecionada.");
  const person = await tx.colaborador.findUnique({ where: { id: identity.colaboradorId } });
  if (!person) throw new ErroHttp(404, "Colaborador não encontrado.");
  const { inicio: start, fim: end } = periodoDaCompetencia(identity.competencia);
  const projects = await tx.projeto.findMany({
    where: { id: { in: dados.projetoIds } },
    include: {
      cliente: { select: { nome: true } },
      sprints: {
        where: { id: { in: dados.sprintIds } },
        select: { id: true, nome: true, projetoId: true },
      },
      equipe: {
        where: {
          colaboradorId: person.id,
          dataEntrada: { lte: end },
          OR: [{ dataSaida: null }, { dataSaida: { gte: start } }],
        },
        select: { papel: true, dataEntrada: true, dataSaida: true },
      },
      tarefas: {
        ...(dados.sprintIds.length ? { where: { sprintId: { in: dados.sprintIds } } } : {}),
        include: {
          sprint: { select: { id: true, nome: true } },
          responsaveis: { include: { colaborador: { select: { nomeCompleto: true } } } },
          apontamentos: { select: { id: true, colaboradorId: true, data: true, horas: true } },
        },
      },
      apontamentos: {
        where: {
          data: { gte: start, lte: end },
          ...(identity.categoria === "DEV" ? { colaboradorId: person.id } : {}),
          ...(dados.sprintIds.length ? { tarefa: { sprintId: { in: dados.sprintIds } } } : {}),
        },
        select: { id: true, tarefaId: true, colaboradorId: true, horas: true, data: true },
      },
    },
    orderBy: { nome: "asc" },
  });
  if (projects.length !== dados.projetoIds.length)
    throw new ErroHttp(400, "Um dos projetos não existe mais.");
  // Só entram projetos em que a pessoa participou da equipe em algum dia da competência,
  // com um papel da categoria avaliada (ex.: quem foi Product Owner não entra como Dev).
  const mes = identity.competencia.split("-").reverse().join("/");
  const semParticipacao = projects.filter((row) => !row.equipe.length).map((row) => row.nome);
  if (semParticipacao.length)
    throw new ErroHttp(
      400,
      `${person.nomeCompleto} não participou da equipe de ${semParticipacao.join(", ")} em ${mes}. Escolha apenas projetos da pessoa no mês.`,
    );
  const outraCategoria = projects.filter(
    (row) => !row.equipe.some((vinculo) => categoriaDoPapel(vinculo.papel) === identity.categoria),
  );
  if (outraCategoria.length)
    throw new ErroHttp(
      400,
      `Na avaliação ${NOME_CATEGORIA[identity.categoria]}, entram só projetos em que ${person.nomeCompleto} teve um papel dessa categoria em ${mes}. ${outraCategoria
        .map(
          (row) =>
            `${row.nome}: ${[...new Set(row.equipe.map((vinculo) => vinculo.papel))].join(", ")}`,
        )
        .join("; ")}.`,
    );
  if (projects.flatMap((row) => row.sprints).length !== dados.sprintIds.length)
    throw new ErroHttp(400, "As sprints precisam pertencer aos projetos selecionados.");
  const filters = {
    dataInicio: start,
    dataFim: end,
    ...(identity.categoria === "DEV" ? { colaboradorId: person.id } : {}),
  };
  const operational = operationalIndicators(projects, filters);
  return json({
    dados,
    colaborador: {
      nome: person.nomeCompleto,
      cargo: person.cargo,
      departamento: person.departamento,
    },
    regra: { nome: rule.nome, categoria: rule.categoria, ...rule.definicao },
    resultado: calculateAward(rule.definicao, dados),
    atualizadoPor: actor.nomeUsuario,
    base: {
      consultadaEm: new Date(),
      inicio: start,
      fim: end,
      escopo:
        identity.categoria === "DEV"
          ? "Tarefas por responsabilidade ou trabalho; estimativas usam o contexto completo da tarefa. Horas no recorte são da pessoa."
          : "Tarefas e horas dos projetos/sprints selecionados; contexto de gestão, sem atribuição automática à pessoa.",
      projetos: projects.map((row) => ({
        id: row.id,
        nome: row.nome,
        cliente: row.cliente.nome,
        papeis: row.equipe,
      })),
      sprints: projects.flatMap((row) => row.sprints),
      indicadores: operational.indicadores,
      tarefas: operational.tarefas,
    },
  });
}

// Período da competência "AAAA-MM": do primeiro ao último dia do mês.
function periodoDaCompetencia(competencia) {
  const inicio = new Date(`${competencia}-01T00:00:00Z`);
  const fim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
  return { inicio, fim };
}

export const premiacaoRepository = {
  templates() {
    return premiacaoTemplates;
  },
  // [BANCO] Projetos em que a pessoa participou da equipe em algum dia da competência, com os
  // papéis do mês. São os únicos que podem entrar na avaliação.
  async projectsForPerson({ colaboradorId, competencia }) {
    const { inicio, fim } = periodoDaCompetencia(competencia);
    const participacao = {
      colaboradorId,
      dataEntrada: { lte: fim },
      OR: [{ dataSaida: null }, { dataSaida: { gte: inicio } }],
    };
    const projetos = await prisma.projeto.findMany({
      where: { equipe: { some: participacao } },
      select: {
        id: true,
        nome: true,
        status: true,
        equipe: { where: participacao, select: { papel: true }, orderBy: { dataEntrada: "asc" } },
      },
      orderBy: { nome: "asc" },
    });
    return projetos.map(({ equipe, ...projeto }) => {
      const papeis = [...new Set(equipe.map((row) => row.papel))];
      return { ...projeto, papeis, categorias: [...new Set(papeis.map(categoriaDoPapel))] };
    });
  },
  rules() {
    return prisma.regraPremiacao.findMany({ orderBy: { id: "desc" } });
  },
  // [BANCO] Publica uma versão de regras (imutável depois de publicada).
  createRule(data, actor) {
    const { nome, categoria, ...definicao } = data;
    return prisma.regraPremiacao.create({
      data: { nome, categoria, definicao, criadoPorId: actor.id },
    });
  },
  async list(where) {
    const rows = await prisma.avaliacaoPremiacao.findMany({
      where,
      include: relations,
      orderBy: [{ competencia: "desc" }, { id: "desc" }],
    });
    return rows.map(({ conteudo, regra, ...row }) => ({
      ...row,
      colaborador: conteudo.colaborador,
      resultado: conteudo.resultado,
      regraNome: regra.nome,
    }));
  },
  async find(id) {
    const row = await prisma.avaliacaoPremiacao.findUnique({ where: { id }, include: relations });
    if (!row) throw new ErroHttp(404, "Avaliação não encontrada.");
    return row;
  },
  // [BANCO] Cria a avaliação em rascunho (ou a reavaliação de uma concluída).
  create(data, actor) {
    return transaction(async (tx) => {
      const rule = await tx.regraPremiacao.findUnique({ where: { id: data.regraId } });
      if (!rule) throw new ErroHttp(404, "Versão das regras não encontrada.");
      const identity = {
        colaboradorId: data.colaboradorId,
        competencia: data.competencia,
        categoria: rule.categoria,
      };
      const previous = data.anteriorId
        ? await tx.avaliacaoPremiacao.findUnique({
            where: { id: data.anteriorId },
            include: { proxima: true },
          })
        : null;
      if (
        data.anteriorId &&
        (!previous ||
          previous.status !== "CONCLUIDA" ||
          previous.proxima ||
          previous.colaboradorId !== identity.colaboradorId ||
          previous.competencia !== identity.competencia ||
          previous.categoria !== identity.categoria)
      )
        throw new ErroHttp(
          409,
          "A reavaliação exige a última versão concluída da mesma pessoa, competência e categoria.",
        );
      const conteudo = await buildAwardContent(tx, identity, rule, data.dados, actor);
      return tx.avaliacaoPremiacao.create({
        data: {
          ...identity,
          regraId: rule.id,
          anteriorId: previous?.id,
          versao: previous ? previous.versao + 1 : 1,
          conteudo,
          criadoPorId: actor.id,
        },
        include: relations,
      });
    });
  },
  // [REGRA] Atualiza o rascunho conferindo a revisão: duas sessões não sobrescrevem o mesmo
  // rascunho.
  update(id, data, actor) {
    return transaction(async (tx) => {
      const previous = await tx.avaliacaoPremiacao.findUnique({
        where: { id },
        include: { regra: true },
      });
      if (!previous) throw new ErroHttp(404, "Avaliação não encontrada.");
      if (previous.status !== "RASCUNHO" || previous.revisao !== data.revisao)
        throw new ErroHttp(
          409,
          "Avaliação concluída ou alterada em outra sessão. Atualize a tela.",
        );
      const conteudo = await buildAwardContent(tx, previous, previous.regra, data.dados, actor);
      return tx.avaliacaoPremiacao.update({
        where: { id },
        data: { conteudo, revisao: { increment: 1 } },
        include: relations,
      });
    });
  },
  // [REGRA] Conclui a avaliação: exige todos os critérios conferidos e trava as respostas.
  close(id, data, actor) {
    return transaction(async (tx) => {
      const previous = await tx.avaliacaoPremiacao.findUnique({ where: { id } });
      if (!previous) throw new ErroHttp(404, "Avaliação não encontrada.");
      if (previous.status !== "RASCUNHO" || previous.revisao !== data.revisao)
        throw new ErroHttp(
          409,
          "Avaliação concluída ou alterada em outra sessão. Atualize a tela.",
        );
      if (previous.conteudo.resultado.pendentes)
        throw new ErroHttp(400, "Confira todos os critérios antes de concluir a avaliação.");
      // Preservar exatamente a base e as respostas que foram revisadas e salvas.
      return tx.avaliacaoPremiacao.update({
        where: { id },
        data: {
          status: "CONCLUIDA",
          revisao: { increment: 1 },
          concluidoEm: new Date(),
          concluidoPorId: actor.id,
        },
        include: relations,
      });
    });
  },
};
