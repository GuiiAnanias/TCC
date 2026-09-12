import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureColaboradorExists(id) {
  const colaborador = await colaboradoresRepository.findById(id);

  if (!colaborador) {
    throw new HttpError(404, "Colaborador não encontrado.");
  }

  return colaborador;
}

export const colaboradoresService = {
  list(filters) {
    return colaboradoresRepository.findAll(filters);
  },

  async getById(id) {
    return ensureColaboradorExists(id);
  },

  async create(data) {
    const colaborador = await colaboradoresRepository.findByEmail(data.email);

    if (colaborador) {
      throw new HttpError(409, "Já existe um colaborador com este e-mail.");
    }

    return colaboradoresRepository.create(data);
  },

  async update(id, data) {
    await ensureColaboradorExists(id);

    if (data.email) {
      const colaborador = await colaboradoresRepository.findByEmail(data.email);

      if (colaborador && colaborador.id !== id) {
        throw new HttpError(409, "Já existe um colaborador com este e-mail.");
      }
    }

    return colaboradoresRepository.update(id, data);
  },

  async inactivate(id) {
    await ensureColaboradorExists(id);
    return colaboradoresRepository.update(id, { status: "INATIVO" });
  }
};
