/**
 * [CONTROLLER] Configuração financeira (valor/hora com vigência) de um colaborador:
 * /api/colaboradores/:id/configuracoes-financeiras.
 */

import {
  configuracaoFinanceiraCreateSchema,
  configuracaoFinanceiraUpdateSchema,
} from "../../schemas/configuracoesFinanceirasSchemas.js";
import { configuracoesFinanceirasService } from "../../services/configuracoesFinanceirasService.js";
import { lerId } from "../../utils/lerId.js";

export const configuracoesFinanceirasController = {
  // [CONTROLLER] Histórico de vigências do colaborador.
  async index(request, response) {
    const colaboradorId = lerId(request.params.id, "colaborador");
    const configuracoes = await configuracoesFinanceirasService.listByColaborador(colaboradorId);
    return response.json(configuracoes);
  },

  // [CONTROLLER] Cria uma vigência nova. [VALIDACAO] schemas/configuracoesFinanceirasSchemas.js; o
  // autor vem de request.user.
  async store(request, response) {
    const colaboradorId = lerId(request.params.id, "colaborador");
    const data = configuracaoFinanceiraCreateSchema.parse(request.body);
    const configuracao = await configuracoesFinanceirasService.createForColaborador(
      colaboradorId,
      data,
      request.user.id,
    );
    return response.status(201).json(configuracao);
  },

  // [CONTROLLER] "Editar" cria outra vigência a partir de uma data: o histórico nunca é alterado.
  async update(request, response) {
    const colaboradorId = lerId(request.params.id, "colaborador");
    const configuracaoId = lerId(request.params.configuracaoId, "configuração financeira");
    const data = configuracaoFinanceiraUpdateSchema.parse(request.body);
    const configuracao = await configuracoesFinanceirasService.updateForColaborador(
      colaboradorId,
      configuracaoId,
      data,
      request.user.id,
    );
    return response.json(configuracao);
  },

  // [CONTROLLER] Encerra a vigência aberta com a data de hoje.
  async destroy(request, response) {
    const colaboradorId = lerId(request.params.id, "colaborador");
    const configuracaoId = lerId(request.params.configuracaoId, "configuração financeira");
    const configuracao = await configuracoesFinanceirasService.closeForColaborador(
      colaboradorId,
      configuracaoId,
      request.user.id,
    );
    return response.json(configuracao);
  },
};
