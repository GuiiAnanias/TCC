/**
 * [SERVICE] Vigências financeiras do colaborador (valor/hora). As regras de datas e a transação
 * ficam em repositories/configuracoesFinanceirasRepository.js.
 */

import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { configuracoesFinanceirasRepository } from "../repositories/configuracoesFinanceirasRepository.js";
import { ErroHttp } from "../utils/ErroHttp.js";

export const configuracoesFinanceirasService = {
  async listByColaborador(colaboradorId) {
    if (!(await colaboradoresRepository.findById(colaboradorId)))
      throw new ErroHttp(404, "Colaborador não encontrado.");
    return configuracoesFinanceirasRepository.findByColaborador(colaboradorId);
  },
  createForColaborador(colaboradorId, data, usuarioId) {
    return configuracoesFinanceirasRepository.replaceActive({ ...data, colaboradorId, usuarioId });
  },
  // [REGRA] "Editar" não altera a vigência: cria outra a partir da data informada, preservando o
  // histórico.
  async updateForColaborador(colaboradorId, configuracaoId, data, usuarioId) {
    const config = await configuracoesFinanceirasRepository.findById(configuracaoId);
    if (!config || config.colaboradorId !== colaboradorId)
      throw new ErroHttp(404, "Configuração financeira não encontrada para este colaborador.");
    if (config.dataFim)
      throw new ErroHttp(
        409,
        "Uma vigência encerrada não pode ser editada. Cadastre uma nova vigência.",
      );
    if (data.dataInicio !== undefined || data.dataFim !== undefined || !data.dataVigencia)
      throw new ErroHttp(
        409,
        "O histórico não pode ser sobrescrito. Informe dataVigencia para criar uma nova configuração, ou use o formulário de nova vigência.",
      );
    return configuracoesFinanceirasRepository.replaceActive({
      colaboradorId,
      itemTabelaId: data.itemTabelaId ?? config.itemTabelaId,
      beneficios: data.beneficios ?? config.beneficios,
      dataInicio: data.dataVigencia,
      motivo: data.motivo,
      usuarioId,
      expectedConfigId: configuracaoId,
    });
  },
  closeForColaborador(colaboradorId, configuracaoId, usuarioId) {
    return configuracoesFinanceirasRepository.close(colaboradorId, configuracaoId, usuarioId);
  },
};
