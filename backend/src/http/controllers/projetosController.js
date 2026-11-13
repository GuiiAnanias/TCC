/**
 * [CONTROLLER] Projetos e equipe do projeto: recebe /api/projetos, valida com
 * schemas/projetosSchemas.js e schemas/equipeProjetoSchemas.js e chama o projetosService.
 */

import {
  projetoCreateSchema,
  projetoQuerySchema,
  projetoUpdateSchema,
} from "../../schemas/projetosSchemas.js";
import {
  equipeProjetoCreateSchema,
  equipeProjetoUpdateSchema,
  papeisProjeto,
} from "../../schemas/equipeProjetoSchemas.js";
import { projetosService } from "../../services/projetosService.js";
import { lerId } from "../../utils/lerId.js";
import { exclusaoProjetosRepository } from "../../repositories/exclusaoProjetosRepository.js";

export const projetosController = {
  // [CONTROLLER] Mostra o que impede a exclusão definitiva (horas, tarefas, avaliações...).
  async deletionInfo(request, response) {
    return response.json(
      await exclusaoProjetosRepository.inspect(lerId(request.params.id, "projeto")),
    );
  },

  // [CONTROLLER] Exclusão definitiva, só para projeto sem nenhum vínculo.
  async deletePermanently(request, response) {
    await exclusaoProjetosRepository.remove(lerId(request.params.id, "projeto"));
    return response.status(204).end();
  },

  // [CONTROLLER] Catálogo de papéis no projeto.
  roles(request, response) {
    return response.json(papeisProjeto);
  },

  // [CONTROLLER] Lista os registros. Os filtros da URL (?busca=&status=) passam pelo schema Zod de
  // consulta.
  async index(request, response) {
    const filters = projetoQuerySchema.parse(request.query);
    const projetos = await projetosService.list(filters);
    return response.json(projetos);
  },

  // [CONTROLLER] Busca um registro pelo id da URL. [VALIDACAO] lerId recusa id que não seja
  // inteiro positivo (400).
  async show(request, response) {
    const id = lerId(request.params.id, "projeto");
    const projeto = await projetosService.getById(id);
    return response.json(projeto);
  },

  // [CONTROLLER] Cadastra. [VALIDACAO] O corpo passa pelo schema Zod de criação antes de chegar ao
  // service; dados inválidos viram 400 no tratarErros.
  async store(request, response) {
    const data = projetoCreateSchema.parse(request.body);
    const projeto = await projetosService.create(data);
    return response.status(201).json(projeto);
  },

  // [CONTROLLER] Edita. [VALIDACAO] Valida o id e o corpo (schema de edição, campos parciais) e
  // chama o service.
  async update(request, response) {
    const id = lerId(request.params.id, "projeto");
    const data = projetoUpdateSchema.parse(request.body);
    const projeto = await projetosService.update(id, data);
    return response.json(projeto);
  },

  // [CONTROLLER] "Excluir" encerra o projeto (status ENCERRADO), sem apagar.
  async destroy(request, response) {
    const id = lerId(request.params.id, "projeto");
    const projeto = await projetosService.close(id);
    return response.json(projeto);
  },

  // [CONTROLLER] Equipe do projeto com o histórico de participações.
  async listTeam(request, response) {
    const projetoId = lerId(request.params.id, "projeto");
    const equipe = await projetosService.listTeam(projetoId);
    return response.json(equipe);
  },

  // [CONTROLLER] Vincula um colaborador com papel e data de entrada.
  async addTeamMember(request, response) {
    const projetoId = lerId(request.params.id, "projeto");
    const data = equipeProjetoCreateSchema.parse(request.body);
    const vinculo = await projetosService.addTeamMember(projetoId, data);
    return response.status(201).json(vinculo);
  },

  // [CONTROLLER] Troca o papel (a partir de uma data) ou corrige as datas da participação.
  async updateTeamMember(request, response) {
    const projetoId = lerId(request.params.id, "projeto");
    const vinculoId = lerId(request.params.vinculoId, "vinculo de equipe");
    const data = equipeProjetoUpdateSchema.parse(request.body);
    const vinculo = await projetosService.updateTeamMember(projetoId, vinculoId, data);
    return response.json(vinculo);
  },

  // [CONTROLLER] Encerra a participação com a data de hoje (o histórico fica).
  async removeTeamMember(request, response) {
    const projetoId = lerId(request.params.id, "projeto");
    const vinculoId = lerId(request.params.vinculoId, "vinculo de equipe");
    const vinculo = await projetosService.removeTeamMember(projetoId, vinculoId);
    return response.json(vinculo);
  },
};
