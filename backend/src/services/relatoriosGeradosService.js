/**
 * [SERVICE][REGRA] Relatórios gerados: grava uma cópia (fotografia) dos dados no momento da
 * geração, para o relatório nunca mudar depois; lista o histórico e devolve a prévia.
 */

import { dashboardService } from "./dashboardService.js";
import { round } from "./operationalIndicators.js";
import { relatoriosGeradosRepository } from "../repositories/relatoriosGeradosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { LIMITE_PROJETOS_RELATORIO } from "../schemas/relatoriosSchemas.js";

// Versão do formato da fotografia. Mudanças no conteúdo gravado exigem outra versão,
// para que relatórios antigos continuem sendo lidos como foram gerados.
// A versão 3 acrescenta título, observações, filtros de equipe, colaborador e status,
// ordenação, colunas da tabela de projetos e os blocos Equipes, Evolução e Apontamentos.
export const VERSAO_RELATORIO = 3;
const ORDENAR = {
  NOME: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
  CUSTO: (a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome, "pt-BR"),
  HORAS: (a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR"),
  ORCAMENTO: (a, b) =>
    (b.orcamento ?? b.custo) - (a.orcamento ?? a.custo) || a.nome.localeCompare(b.nome, "pt-BR"),
};
const ordenar = (linhas, ordenacao = "NOME") =>
  [...linhas].sort(ORDENAR[ordenacao] ?? ORDENAR.NOME);
const TIPOS_OCORRENCIA = [
  "SEM_REMUNERACAO",
  "SEM_VINCULO",
  "SEM_TAREFA",
  "SEM_ESTIMATIVA",
  "CONCLUIDA_SEM_HORAS",
];
const dia = (valor) => (valor ? new Date(valor).toISOString().slice(0, 10) : null);

function blocoHoras(relatorio) {
  const porStatus = { PENDENTE: 0, APROVADO: 0, FATURADO: 0 };
  const pessoas = new Map();
  for (const linha of relatorio.apontamentos) {
    porStatus[linha.status] = round((porStatus[linha.status] ?? 0) + linha.horas);
    if (!pessoas.has(linha.colaboradorId))
      pessoas.set(linha.colaboradorId, {
        id: linha.colaboradorId,
        nome: linha.colaborador,
        departamento: linha.departamento,
        projetos: new Set(),
        horas: 0,
      });
    const pessoa = pessoas.get(linha.colaboradorId);
    pessoa.projetos.add(linha.projetoId);
    pessoa.horas = round(pessoa.horas + linha.horas);
  }
  return {
    total: relatorio.resumo.horas,
    apontamentos: relatorio.apontamentos.length,
    horasSemCusto: relatorio.resumo.horasSemCusto,
    horasSemTarefa: relatorio.resumo.horasSemTarefa ?? 0,
    porStatus,
    porColaborador: [...pessoas.values()]
      .map((pessoa) => ({ ...pessoa, projetos: pessoa.projetos.size }))
      .sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

const montarBloco = {
  PROJETOS: (relatorio, { ordenacao }) => ({
    linhas: ordenar(relatorio.projetos, ordenacao).map((row) => ({
      id: row.id,
      nome: row.nome,
      cliente: row.cliente,
      clienteId: row.clienteId,
      status: row.status,
      orcamento: row.orcamento,
      horas: row.horas,
      custoBase: row.custoBase,
      bonificacao: row.bonificacao,
      custo: row.custo,
      horasSemCusto: row.horasSemCusto,
      assertividade: row.assertividade,
      inconsistencias: row.inconsistencias,
    })),
  }),
  CLIENTES: (relatorio, { ordenacao }) => ({
    // Cliente não tem orçamento próprio: nessa ordenação vale o custo.
    linhas: ordenar(relatorio.clientes, ordenacao).map((row) => ({
      id: row.id,
      nome: row.nome,
      projetos: row.projetos,
      horas: row.horas,
      custoBase: row.custoBase,
      bonificacao: row.bonificacao,
      custo: row.custo,
      horasSemCusto: row.horasSemCusto,
    })),
  }),
  EQUIPES: (relatorio) => ({
    linhas: relatorio.equipes.map((row) => ({
      nome: row.equipe,
      colaboradores: row.colaboradores,
      projetos: row.projetos,
      horas: row.horas,
      custoBase: row.custoBase,
      bonificacao: row.bonificacao,
      custo: row.custo,
      horasSemCusto: row.horasSemCusto,
    })),
  }),
  HORAS: blocoHoras,
  EVOLUCAO: (relatorio) => ({
    linhas: relatorio.evolucao.map((row) => ({
      mes: row.mes,
      apontamentos: row.apontamentos,
      horas: row.horas,
      custoBase: row.custoBase,
      bonificacao: row.bonificacao,
      custo: row.custo,
    })),
  }),
  APONTAMENTOS: (relatorio) => ({
    linhas: relatorio.apontamentos.map((row) => ({
      id: row.id,
      data: row.data,
      projeto: row.projeto,
      tarefa: row.tarefa,
      colaborador: row.colaborador,
      horas: row.horas,
      status: row.status,
      custo: row.custo,
      semCusto: Boolean(row.semCusto),
      descricao: row.descricao,
    })),
  }),
  CUSTO: ({ resumo }) => ({
    total: resumo.custo,
    custoBase: resumo.custoBase,
    bonificacao: resumo.bonificacao,
    parcial: resumo.horasSemCusto > 0,
    horasSemCusto: resumo.horasSemCusto,
    assertividadeMedia: resumo.assertividade,
    projetosComAssertividade: resumo.projetosComAssertividade,
  }),
  INCONSISTENCIAS: ({ ocorrencias }) => ({
    total: ocorrencias.length,
    porTipo: Object.fromEntries(
      TIPOS_OCORRENCIA.map((tipo) => [tipo, ocorrencias.filter((row) => row.tipo === tipo).length]),
    ),
    ocorrencias: ocorrencias.map((row) => ({
      tipo: row.tipo,
      projetoId: row.projetoId,
      projeto: row.projeto,
      colaborador: row.colaborador ?? null,
      tarefa: row.tarefa ?? null,
      data: dia(row.data),
      descricao: row.descricao,
    })),
  }),
};

/**
 * Monta o conteúdo gravado a partir do recorte calculado pelo dashboard. Só os blocos
 * escolhidos entram; `projetos` lista todo o recorte, para registrar as referências.
 */
// [REGRA] Monta a cópia dos dados com os blocos escolhidos (Projetos, Clientes, Horas, Custo,
// Inconsistências).
export function montarFotografia(relatorio, { filtros, blocos, geradoEm, opcoes = {} }) {
  const escolhas = {
    titulo: opcoes.titulo ?? null,
    observacoes: opcoes.observacoes ?? null,
    ordenacao: opcoes.ordenacao ?? "NOME",
    colunasProjetos: opcoes.colunasProjetos ?? null,
  };
  return {
    versao: VERSAO_RELATORIO,
    geradoEm: geradoEm.toISOString(),
    filtros,
    nomesFiltros: { colaborador: relatorio.nomesFiltros?.colaborador ?? null },
    opcoes: escolhas,
    blocos,
    projetos: relatorio.projetos.map((row) => ({
      id: row.id,
      nome: row.nome,
      cliente: row.cliente,
      clienteId: row.clienteId,
      status: row.status,
    })),
    dados: Object.fromEntries(
      blocos.map((bloco) => [bloco, montarBloco[bloco](relatorio, escolhas)]),
    ),
  };
}

function formatar(registro) {
  return {
    id: registro.id,
    versao: registro.versao,
    filtros: registro.filtros,
    blocos: registro.blocos,
    conteudo: registro.conteudo,
    autor: registro.criadoPor?.nomeUsuario ?? null,
    criadoEm: registro.createdAt,
  };
}

/** Linha do histórico: o que foi pedido, quem gerou e quais formatos já foram baixados. */
export function resumoDoHistorico(registro, exportacoes = []) {
  const { conteudo, filtros = {} } = registro;
  const projetos = conteudo?.projetos ?? [];
  const escolhidos = new Set(filtros.projetoIds ?? []);
  const clientes = new Set(filtros.clienteIds ?? []);
  const proprias = exportacoes.filter((row) => row.relatorioId === registro.id);
  const contar = (formato) => proprias.find((row) => row.formato === formato)?._count?._all ?? 0;
  const ultimas = proprias.map((row) => row._max?.createdAt).filter(Boolean);
  return {
    id: registro.id,
    versao: registro.versao,
    criadoEm: registro.createdAt,
    autor: registro.criadoPor?.nomeUsuario ?? null,
    autorId: registro.criadoPor?.id ?? registro.criadoPorId ?? null,
    blocos: registro.blocos,
    periodo: { dataInicio: filtros.dataInicio ?? null, dataFim: filtros.dataFim ?? null },
    clientes: [
      ...new Map(
        projetos
          .filter((row) => clientes.has(row.clienteId))
          .map((row) => [row.clienteId, row.cliente]),
      ).values(),
    ],
    projetosSelecionados: projetos.filter((row) => escolhidos.has(row.id)).map((row) => row.nome),
    projetosNoRecorte: projetos.length,
    titulo: conteudo?.opcoes?.titulo ?? null,
    exportacoes: {
      PDF: contar("PDF"),
      XLSX: contar("XLSX"),
      ultima: ultimas.length ? new Date(Math.max(...ultimas.map((data) => +new Date(data)))) : null,
    },
  };
}

export const relatoriosGeradosService = {
  // [SERVICE] Histórico paginado com filtros (projeto, período de geração, só os meus).
  async listar(filtros) {
    const { total, registros, exportacoes } = await relatoriosGeradosRepository.list(filtros);
    return {
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
      total,
      paginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
      itens: registros.map((registro) => resumoDoHistorico(registro, exportacoes)),
    };
  },
  // [SERVICE] Prévia: calcula o recorte com as mesmas regras de gerar, mas não grava nada.
  // Serve para conferir o relatório antes de ele entrar no histórico.
  async previa(dados, usuario, agora = new Date()) {
    const { filtros, blocos, conteudo } = await montarConteudo(dados, agora);
    return {
      id: null,
      previa: true,
      versao: VERSAO_RELATORIO,
      filtros,
      blocos,
      conteudo,
      autor: usuario?.nomeUsuario ?? null,
      criadoEm: agora.toISOString(),
    };
  },
  // [SERVICE] Calcula o recorte, grava a fotografia e devolve o número do relatório.
  async gerar(dados, usuario, agora = new Date()) {
    const { filtros, blocos, conteudo } = await montarConteudo(dados, agora);
    try {
      return formatar(
        await relatoriosGeradosRepository.create({
          versao: VERSAO_RELATORIO,
          filtros,
          blocos,
          conteudo,
          criadoPorId: usuario.id,
        }),
      );
    } catch (error) {
      if (error.code === "P2003")
        throw new HttpError(
          409,
          "Um projeto do recorte foi excluído durante a geração. Gere o relatório de novo.",
        );
      throw error;
    }
  },
  // [SERVICE][ERRO] Abre um relatório pelo número; inexistente: 404.
  async buscar(id) {
    const registro = await relatoriosGeradosRepository.findById(id);
    if (!registro) throw new HttpError(404, "Relatório não encontrado.");
    return formatar(registro);
  },
};

// [REGRA] Confere as escolhas, consulta o recorte e monta a fotografia (usada pela prévia e
// pela gravação, para as duas mostrarem exatamente o mesmo cálculo).
async function montarConteudo(dados, agora) {
  const { projetoIds: escolhidos, clienteIds = [], blocos } = dados;
  if (
    escolhidos.length &&
    (await relatoriosGeradosRepository.countProjects(escolhidos)) !== escolhidos.length
  )
    throw new HttpError(400, "Um dos projetos escolhidos não existe mais. Atualize a lista.");
  const clientes = clienteIds.length
    ? await relatoriosGeradosRepository.findClients(clienteIds)
    : [];
  if (clientes.length !== clienteIds.length)
    throw new HttpError(400, "Um dos clientes escolhidos não existe mais. Atualize a lista.");
  // Clientes e projetos são escolhas aditivas. A união por ID evita duplicar custos.
  const projetoIds = [
    ...new Set([
      ...escolhidos,
      ...clientes.flatMap((cliente) => cliente.projetos.map((projeto) => projeto.id)),
    ]),
  ].sort((a, b) => a - b);
  if (projetoIds.length > LIMITE_PROJETOS_RELATORIO)
    throw new HttpError(
      400,
      "O recorte inclui mais de 50 projetos. Selecione projetos individualmente para reduzir.",
    );
  // Cliente sem projetos não pode virar uma consulta sem filtro de projeto.
  if (clienteIds.length && !projetoIds.length)
    throw new HttpError(422, "Os clientes escolhidos não têm projetos para gerar o relatório.");
  // Filtros extras só entram no registro quando foram usados.
  const extras = {
    ...(dados.equipe ? { equipe: dados.equipe } : {}),
    ...(dados.colaboradorId ? { colaboradorId: dados.colaboradorId } : {}),
    ...(dados.statusProjeto ? { statusProjeto: dados.statusProjeto } : {}),
    ...(dados.statusApontamentos?.length ? { statusApontamentos: dados.statusApontamentos } : {}),
  };
  const filtros = {
    projetoIds,
    ...(clienteIds.length ? { clienteIds } : {}),
    dataInicio: dia(dados.dataInicio),
    dataFim: dia(dados.dataFim),
    ...extras,
  };
  // Sem filtro de estado, projetos escolhidos e históricos entram como estão.
  const relatorio = await dashboardService.report({
    ...(projetoIds.length ? { projetoIds } : {}),
    ...(dados.dataInicio ? { dataInicio: dados.dataInicio } : {}),
    ...(dados.dataFim ? { dataFim: dados.dataFim } : {}),
    ...extras,
  });
  if (dados.colaboradorId && !relatorio.nomesFiltros?.colaborador)
    throw new HttpError(400, "O colaborador escolhido não existe mais. Atualize a lista.");
  if (!relatorio.projetos.length)
    throw new HttpError(
      422,
      "Nenhum projeto tem dados no recorte escolhido. Ajuste os filtros antes de gerar.",
    );
  const conteudo = montarFotografia(relatorio, {
    filtros,
    blocos,
    geradoEm: agora,
    opcoes: {
      titulo: dados.titulo,
      observacoes: dados.observacoes,
      ordenacao: dados.ordenacao,
      colunasProjetos: dados.colunasProjetos,
    },
  });
  return { filtros, blocos, conteudo };
}
