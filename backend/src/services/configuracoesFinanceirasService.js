import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { configuracoesFinanceirasRepository } from "../repositories/configuracoesFinanceirasRepository.js";
import { remuneracoesRepository } from "../repositories/remuneracoesRepository.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureColaboradorExists(id) {
  const colaborador = await colaboradoresRepository.findById(id);

  if (!colaborador) {
    throw new HttpError(404, "Colaborador não encontrado.");
  }

  return colaborador;
}

async function ensureColaboradorAtivo(id) {
  const colaborador = await ensureColaboradorExists(id);

  if (colaborador.status !== "ATIVO") {
    throw new HttpError(400, "Não é possível alterar configuração financeira de colaborador inativo.");
  }

  return colaborador;
}

async function ensureItemTabelaAtivo(id) {
  const itemTabela = await remuneracoesRepository.findById(id);

  if (!itemTabela) {
    throw new HttpError(404, "Item da tabela de remuneração não encontrado.");
  }

  if (itemTabela.status !== "ATIVO") {
    throw new HttpError(400, "Não é possível usar item de remuneração inativo.");
  }

  return itemTabela;
}

async function ensureConfiguracaoDoColaborador(colaboradorId, configuracaoId) {
  const configuracao = await configuracoesFinanceirasRepository.findById(configuracaoId);

  if (!configuracao || configuracao.colaboradorId !== colaboradorId) {
    throw new HttpError(404, "Configuração financeira não encontrada para este colaborador.");
  }

  return configuracao;
}

function ensurePeriodoValido(dataInicio, dataFim) {
  if (dataFim && dataInicio && dataFim < dataInicio) {
    throw new HttpError(400, "Data de fim não pode ser anterior à data de início.");
  }
}

export const configuracoesFinanceirasService = {
  async listByColaborador(colaboradorId) {
    await ensureColaboradorExists(colaboradorId);
    return configuracoesFinanceirasRepository.findByColaborador(colaboradorId);
  },

  async createForColaborador(colaboradorId, data) {
    await ensureColaboradorAtivo(colaboradorId);
    await ensureItemTabelaAtivo(data.itemTabelaId);

    const activeConfig = await configuracoesFinanceirasRepository.findActiveByColaborador(colaboradorId);

    if (activeConfig && data.dataInicio < activeConfig.dataInicio) {
      throw new HttpError(400, "A nova vigência não pode iniciar antes da configuração financeira vigente.");
    }

    return configuracoesFinanceirasRepository.replaceActive({
      colaboradorId,
      itemTabelaId: data.itemTabelaId,
      beneficios: data.beneficios,
      dataInicio: data.dataInicio
    });
  },

  async updateForColaborador(colaboradorId, configuracaoId, data) {
    await ensureColaboradorAtivo(colaboradorId);
    const configuracao = await ensureConfiguracaoDoColaborador(colaboradorId, configuracaoId);

    if (data.itemTabelaId) {
      await ensureItemTabelaAtivo(data.itemTabelaId);
    }

    const nextDataInicio = data.dataInicio ?? configuracao.dataInicio;
    const nextDataFim = data.dataFim === undefined ? configuracao.dataFim : data.dataFim;

    ensurePeriodoValido(nextDataInicio, nextDataFim);

    return configuracoesFinanceirasRepository.update(configuracaoId, data);
  },

  async closeForColaborador(colaboradorId, configuracaoId) {
    await ensureColaboradorAtivo(colaboradorId);
    const configuracao = await ensureConfiguracaoDoColaborador(colaboradorId, configuracaoId);

    if (configuracao.dataFim) {
      return configuracao;
    }

    const dataFim = new Date();

    return configuracoesFinanceirasRepository.update(configuracaoId, {
      dataFim: dataFim < configuracao.dataInicio ? configuracao.dataInicio : dataFim
    });
  }
};
