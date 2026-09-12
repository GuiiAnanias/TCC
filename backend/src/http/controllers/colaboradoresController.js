import {
  colaboradorCreateSchema,
  colaboradorQuerySchema,
  colaboradorUpdateSchema
} from "../../schemas/colaboradoresSchemas.js";
import { colaboradoresService } from "../../services/colaboradoresService.js";
import { parseId } from "../../utils/parseId.js";

export const colaboradoresController = {
  async index(request, response) {
    const filters = colaboradorQuerySchema.parse(request.query);
    const colaboradores = await colaboradoresService.list(filters);
    return response.json(colaboradores);
  },

  async show(request, response) {
    const id = parseId(request.params.id, "colaborador");
    const colaborador = await colaboradoresService.getById(id);
    return response.json(colaborador);
  },

  async store(request, response) {
    const data = colaboradorCreateSchema.parse(request.body);
    const colaborador = await colaboradoresService.create(data);
    return response.status(201).json(colaborador);
  },

  async update(request, response) {
    const id = parseId(request.params.id, "colaborador");
    const data = colaboradorUpdateSchema.parse(request.body);
    const colaborador = await colaboradoresService.update(id, data);
    return response.json(colaborador);
  },

  async destroy(request, response) {
    const id = parseId(request.params.id, "colaborador");
    const colaborador = await colaboradoresService.inactivate(id);
    return response.json(colaborador);
  }
};
