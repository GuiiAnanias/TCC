/**
 * [CONTROLLER] Clientes: recebe as requisições de /api/clientes, valida a entrada com os schemas
 * Zod (schemas/clientesSchemas.js) e chama o clientesService. Não acessa o banco.
 */

import {
  clienteCreateSchema,
  clienteQuerySchema,
  clienteUpdateSchema,
} from "../../schemas/clientesSchemas.js";
import { clientesService } from "../../services/clientesService.js";
import { lerId } from "../../utils/lerId.js";
import { consultarCnpj } from "../../services/cnpjService.js";
import { consultarCep } from "../../services/cepService.js";

export const clientesController = {
  // [API-EXTERNA] Endereço pelo CEP (ViaCEP), via services/cepService.js.
  async consultarCep(request, response) {
    return response.json(await consultarCep(request.params.cep));
  },
  // [API-EXTERNA] Dados da empresa pelo CNPJ (ReceitaWS), via services/cnpjService.js.
  async consultarCnpj(request, response) {
    return response.json(await consultarCnpj(request.params.cnpj));
  },
  // [CONTROLLER] Lista os registros. Os filtros da URL (?busca=&status=) passam pelo schema Zod de
  // consulta.
  async index(request, response) {
    const filters = clienteQuerySchema.parse(request.query);
    const clientes = await clientesService.list(filters);
    return response.json(clientes);
  },

  // [CONTROLLER] Busca um registro pelo id da URL. [VALIDACAO] lerId recusa id que não seja
  // inteiro positivo (400).
  async show(request, response) {
    const id = lerId(request.params.id, "cliente");
    const cliente = await clientesService.getById(id);
    return response.json(cliente);
  },

  // [CONTROLLER] Cadastra. [VALIDACAO] O corpo passa pelo schema Zod de criação antes de chegar ao
  // service; dados inválidos viram 400 no tratarErros.
  async store(request, response) {
    const data = clienteCreateSchema.parse(request.body);
    const cliente = await clientesService.create(data);
    return response.status(201).json(cliente);
  },

  // [CONTROLLER] Edita. [VALIDACAO] Valida o id e o corpo (schema de edição, campos parciais) e
  // chama o service.
  async update(request, response) {
    const id = lerId(request.params.id, "cliente");
    const data = clienteUpdateSchema.parse(request.body);
    const cliente = await clientesService.update(id, data);
    return response.json(cliente);
  },

  // [CONTROLLER] "Excluir" na tela: inativa o registro (não apaga do banco), para preservar o
  // histórico.
  async destroy(request, response) {
    const id = lerId(request.params.id, "cliente");
    const cliente = await clientesService.inactivate(id);
    return response.json(cliente);
  },
};
