import { clientesRepository } from "../repositories/clientesRepository.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureClienteExists(id) {
  const cliente = await clientesRepository.findById(id);

  if (!cliente) {
    throw new HttpError(404, "Cliente não encontrado.");
  }

  return cliente;
}

export const clientesService = {
  list(filters) {
    return clientesRepository.findAll(filters);
  },

  async getById(id) {
    return ensureClienteExists(id);
  },

  async create(data) {
    if (data.cnpj && await clientesRepository.findByCnpj(data.cnpj)) throw new HttpError(409, "Já existe um cliente com este CNPJ.");
    const cliente = await clientesRepository.findByNome(data.nome);

    if (cliente) {
      throw new HttpError(409, "Já existe um cliente com este nome.");
    }

    return clientesRepository.create(data);
  },

  async update(id, data) {
    await ensureClienteExists(id);
    if (data.cnpj) {
      const duplicate = await clientesRepository.findByCnpj(data.cnpj);
      if (duplicate && duplicate.id !== id) throw new HttpError(409, "Já existe um cliente com este CNPJ.");
    }

    if (data.nome) {
      const cliente = await clientesRepository.findByNome(data.nome);

      if (cliente && cliente.id !== id) {
        throw new HttpError(409, "Já existe um cliente com este nome.");
      }
    }

    return clientesRepository.update(id, data);
  },

  async inactivate(id) {
    await ensureClienteExists(id);
    return clientesRepository.update(id, { status: "INATIVO" });
  }
};
