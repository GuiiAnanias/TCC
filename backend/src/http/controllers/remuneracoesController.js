import {
  remuneracaoCreateSchema,
  remuneracaoQuerySchema,
  remuneracaoUpdateSchema
} from "../../schemas/remuneracoesSchemas.js";
import { remuneracoesService } from "../../services/remuneracoesService.js";
import { parseId } from "../../utils/parseId.js";

export const remuneracoesController = {
  async index(request, response) {
    const filters = remuneracaoQuerySchema.parse(request.query);
    const remuneracoes = await remuneracoesService.list(filters);
    return response.json(remuneracoes);
  },

  async show(request, response) {
    const id = parseId(request.params.id, "item de remuneração");
    const remuneracao = await remuneracoesService.getById(id);
    return response.json(remuneracao);
  },

  async store(request, response) {
    const data = remuneracaoCreateSchema.parse(request.body);
    const remuneracao = await remuneracoesService.create(data);
    return response.status(201).json(remuneracao);
  },

  async update(request, response) {
    const id = parseId(request.params.id, "item de remuneração");
    const data = remuneracaoUpdateSchema.parse(request.body);
    const remuneracao = await remuneracoesService.update(id, data);
    return response.json(remuneracao);
  },

  async destroy(request, response) {
    const id = parseId(request.params.id, "item de remuneração");
    const remuneracao = await remuneracoesService.inactivate(id);
    return response.json(remuneracao);
  }
};
