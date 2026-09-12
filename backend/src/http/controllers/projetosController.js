import { projetoCreateSchema, projetoQuerySchema, projetoUpdateSchema } from "../../schemas/projetosSchemas.js";
import {
  equipeProjetoCreateSchema,
  equipeProjetoUpdateSchema,
  papeisProjeto
} from "../../schemas/equipeProjetoSchemas.js";
import { projetosService } from "../../services/projetosService.js";
import { parseId } from "../../utils/parseId.js";

export const projetosController = {
  roles(request, response) {
    return response.json(papeisProjeto);
  },

  async index(request, response) {
    const filters = projetoQuerySchema.parse(request.query);
    const projetos = await projetosService.list(filters);
    return response.json(projetos);
  },

  async show(request, response) {
    const id = parseId(request.params.id, "projeto");
    const projeto = await projetosService.getById(id);
    return response.json(projeto);
  },

  async store(request, response) {
    const data = projetoCreateSchema.parse(request.body);
    const projeto = await projetosService.create(data);
    return response.status(201).json(projeto);
  },

  async update(request, response) {
    const id = parseId(request.params.id, "projeto");
    const data = projetoUpdateSchema.parse(request.body);
    const projeto = await projetosService.update(id, data);
    return response.json(projeto);
  },

  async destroy(request, response) {
    const id = parseId(request.params.id, "projeto");
    const projeto = await projetosService.inactivate(id);
    return response.json(projeto);
  },

  async listTeam(request, response) {
    const projetoId = parseId(request.params.id, "projeto");
    const equipe = await projetosService.listTeam(projetoId);
    return response.json(equipe);
  },

  async addTeamMember(request, response) {
    const projetoId = parseId(request.params.id, "projeto");
    const data = equipeProjetoCreateSchema.parse(request.body);
    const vinculo = await projetosService.addTeamMember(projetoId, data);
    return response.status(201).json(vinculo);
  },

  async updateTeamMember(request, response) {
    const projetoId = parseId(request.params.id, "projeto");
    const vinculoId = parseId(request.params.vinculoId, "vinculo de equipe");
    const data = equipeProjetoUpdateSchema.parse(request.body);
    const vinculo = await projetosService.updateTeamMember(projetoId, vinculoId, data);
    return response.json(vinculo);
  },

  async removeTeamMember(request, response) {
    const projetoId = parseId(request.params.id, "projeto");
    const vinculoId = parseId(request.params.vinculoId, "vinculo de equipe");
    const vinculo = await projetosService.removeTeamMember(projetoId, vinculoId);
    return response.json(vinculo);
  }
};
