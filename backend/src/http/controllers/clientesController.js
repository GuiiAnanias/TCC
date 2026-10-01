import { clienteCreateSchema, clienteQuerySchema, clienteUpdateSchema } from "../../schemas/clientesSchemas.js";
import { clientesService } from "../../services/clientesService.js";
import { parseId } from "../../utils/parseId.js";
import { consultarCnpj } from "../../services/cnpjService.js";

export const clientesController = {
  async consultarCnpj(request, response) {
    return response.json(await consultarCnpj(request.params.cnpj));
  },
  async index(request, response) {
    const filters = clienteQuerySchema.parse(request.query);
    const clientes = await clientesService.list(filters);
    return response.json(clientes);
  },

  async show(request, response) {
    const id = parseId(request.params.id, "cliente");
    const cliente = await clientesService.getById(id);
    return response.json(cliente);
  },

  async store(request, response) {
    const data = clienteCreateSchema.parse(request.body);
    const cliente = await clientesService.create(data);
    return response.status(201).json(cliente);
  },

  async update(request, response) {
    const id = parseId(request.params.id, "cliente");
    const data = clienteUpdateSchema.parse(request.body);
    const cliente = await clientesService.update(id, data);
    return response.json(cliente);
  },

  async destroy(request, response) {
    const id = parseId(request.params.id, "cliente");
    const cliente = await clientesService.inactivate(id);
    return response.json(cliente);
  }
};
