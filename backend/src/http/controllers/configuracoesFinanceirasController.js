import {
  configuracaoFinanceiraCreateSchema,
  configuracaoFinanceiraUpdateSchema
} from "../../schemas/configuracoesFinanceirasSchemas.js";
import { configuracoesFinanceirasService } from "../../services/configuracoesFinanceirasService.js";
import { parseId } from "../../utils/parseId.js";

export const configuracoesFinanceirasController = {
  async index(request, response) {
    const colaboradorId = parseId(request.params.id, "colaborador");
    const configuracoes = await configuracoesFinanceirasService.listByColaborador(colaboradorId);
    return response.json(configuracoes);
  },

  async store(request, response) {
    const colaboradorId = parseId(request.params.id, "colaborador");
    const data = configuracaoFinanceiraCreateSchema.parse(request.body);
    const configuracao = await configuracoesFinanceirasService.createForColaborador(colaboradorId, data, request.user.id);
    return response.status(201).json(configuracao);
  },

  async update(request, response) {
    const colaboradorId = parseId(request.params.id, "colaborador");
    const configuracaoId = parseId(request.params.configuracaoId, "configuração financeira");
    const data = configuracaoFinanceiraUpdateSchema.parse(request.body);
    const configuracao = await configuracoesFinanceirasService.updateForColaborador(
      colaboradorId,
      configuracaoId,
      data,
      request.user.id
    );
    return response.json(configuracao);
  },

  async destroy(request, response) {
    const colaboradorId = parseId(request.params.id, "colaborador");
    const configuracaoId = parseId(request.params.configuracaoId, "configuração financeira");
    const configuracao = await configuracoesFinanceirasService.closeForColaborador(colaboradorId, configuracaoId, request.user.id);
    return response.json(configuracao);
  }
};
