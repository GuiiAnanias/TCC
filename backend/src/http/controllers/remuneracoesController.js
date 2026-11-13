/**
 * [CONTROLLER] Tabela de remuneração: recebe /api/remuneracoes, valida com
 * schemas/remuneracoesSchemas.js e chama o remuneracoesService.
 */

import {
  remuneracaoCreateSchema,
  remuneracaoQuerySchema,
  remuneracaoUpdateSchema,
} from "../../schemas/remuneracoesSchemas.js";
import { remuneracoesService } from "../../services/remuneracoesService.js";
import { lerId } from "../../utils/lerId.js";

export const remuneracoesController = {
  // [CONTROLLER] Lista os registros. Os filtros da URL (?busca=&status=) passam pelo schema Zod de
  // consulta.
  async index(request, response) {
    const filters = remuneracaoQuerySchema.parse(request.query);
    const remuneracoes = await remuneracoesService.list(filters);
    return response.json(remuneracoes);
  },

  // [CONTROLLER] Busca um registro pelo id da URL. [VALIDACAO] lerId recusa id que não seja
  // inteiro positivo (400).
  async show(request, response) {
    const id = lerId(request.params.id, "item de remuneração");
    const remuneracao = await remuneracoesService.getById(id);
    return response.json(remuneracao);
  },

  // [CONTROLLER] Cadastra. [VALIDACAO] O corpo passa pelo schema Zod de criação antes de chegar ao
  // service; dados inválidos viram 400 no tratarErros.
  async store(request, response) {
    const data = remuneracaoCreateSchema.parse(request.body);
    const remuneracao = await remuneracoesService.create(data);
    return response.status(201).json(remuneracao);
  },

  // [CONTROLLER] Edita. [VALIDACAO] Valida o id e o corpo (schema de edição, campos parciais) e
  // chama o service.
  async update(request, response) {
    const id = lerId(request.params.id, "item de remuneração");
    const data = remuneracaoUpdateSchema.parse(request.body);
    const remuneracao = await remuneracoesService.update(id, data);
    return response.json(remuneracao);
  },

  // [CONTROLLER] "Excluir" na tela: inativa o registro (não apaga do banco), para preservar o
  // histórico.
  async destroy(request, response) {
    const id = lerId(request.params.id, "item de remuneração");
    const remuneracao = await remuneracoesService.inactivate(id);
    return response.json(remuneracao);
  },
};
