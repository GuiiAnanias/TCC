import { dashboardService } from "./dashboardService.js";
import { round } from "./operationalIndicators.js";
import { relatoriosGeradosRepository } from "../repositories/relatoriosGeradosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { LIMITE_PROJETOS_RELATORIO } from "../schemas/relatoriosSchemas.js";

// Versão do formato da fotografia. Mudanças no conteúdo gravado exigem outra versão,
// para que relatórios antigos continuem sendo lidos como foram gerados.
export const VERSAO_RELATORIO = 2;
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
  PROJETOS: (relatorio) => ({
    linhas: relatorio.projetos.map((row) => ({
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
  CLIENTES: (relatorio) => ({
    linhas: relatorio.clientes.map((row) => ({
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
  HORAS: blocoHoras,
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
export function montarFotografia(relatorio, { filtros, blocos, geradoEm }) {
  return {
    versao: VERSAO_RELATORIO,
    geradoEm: geradoEm.toISOString(),
    filtros,
    blocos,
    projetos: relatorio.projetos.map((row) => ({
      id: row.id,
      nome: row.nome,
      cliente: row.cliente,
      clienteId: row.clienteId,
      status: row.status,
    })),
    dados: Object.fromEntries(blocos.map((bloco) => [bloco, montarBloco[bloco](relatorio)])),
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

export const relatoriosGeradosService = {
  async gerar(dados, usuario, agora = new Date()) {
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
    const filtros = {
      projetoIds,
      ...(clienteIds.length ? { clienteIds } : {}),
      dataInicio: dia(dados.dataInicio),
      dataFim: dia(dados.dataFim),
    };
    // Sem filtro de estado: projetos escolhidos e históricos entram como estão.
    const relatorio = await dashboardService.report({
      ...(projetoIds.length ? { projetoIds } : {}),
      ...(dados.dataInicio ? { dataInicio: dados.dataInicio } : {}),
      ...(dados.dataFim ? { dataFim: dados.dataFim } : {}),
    });
    if (!relatorio.projetos.length)
      throw new HttpError(
        422,
        "Nenhum projeto tem dados no recorte escolhido. Ajuste os filtros antes de gerar.",
      );
    const conteudo = montarFotografia(relatorio, { filtros, blocos, geradoEm: agora });
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
  async buscar(id) {
    const registro = await relatoriosGeradosRepository.findById(id);
    if (!registro) throw new HttpError(404, "Relatório não encontrado.");
    return formatar(registro);
  },
};
