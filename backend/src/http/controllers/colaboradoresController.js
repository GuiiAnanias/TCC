/**
 * [CONTROLLER] Colaboradores: recebe /api/colaboradores, valida com schemas/colaboradoresSchemas.js
 * e chama o colaboradoresService.
 */

import {
  colaboradorCreateSchema,
  colaboradorQuerySchema,
  colaboradorUpdateSchema,
} from "../../schemas/colaboradoresSchemas.js";
import { colaboradoresService } from "../../services/colaboradoresService.js";
import { parseId } from "../../utils/parseId.js";

export const colaboradoresController = {
  // [CONTROLLER] Lista os registros. Os filtros da URL (?busca=&status=) passam pelo schema Zod de
  // consulta.
  async index(request, response) {
    const filters = colaboradorQuerySchema.parse(request.query);
    const colaboradores = await colaboradoresService.list(filters);
    return response.json(colaboradores);
  },

  // [CONTROLLER] Busca um registro pelo id da URL. [VALIDACAO] parseId recusa id que não seja
  // inteiro positivo (400).
  async show(request, response) {
    const id = parseId(request.params.id, "colaborador");
    const colaborador = await colaboradoresService.getById(id);
    return response.json(colaborador);
  },

  // [CONTROLLER] Cadastra. [VALIDACAO] O corpo passa pelo schema Zod de criação antes de chegar ao
  // service; dados inválidos viram 400 no errorHandler.
  async store(request, response) {
    const data = colaboradorCreateSchema.parse(request.body);
    const colaborador = await colaboradoresService.create(data);
    return response.status(201).json(colaborador);
  },

  // [CONTROLLER] Edita. [VALIDACAO] Valida o id e o corpo (schema de edição, campos parciais) e
  // chama o service.
  async update(request, response) {
    const id = parseId(request.params.id, "colaborador");
    const data = colaboradorUpdateSchema.parse(request.body);
    const colaborador = await colaboradoresService.update(id, data);
    return response.json(colaborador);
  },

  // [CONTROLLER] "Excluir" na tela: inativa o registro (não apaga do banco), para preservar o
  // histórico.
  async destroy(request, response) {
    const id = parseId(request.params.id, "colaborador");
    const colaborador = await colaboradoresService.inactivate(id);
    return response.json(colaborador);
  },
};
