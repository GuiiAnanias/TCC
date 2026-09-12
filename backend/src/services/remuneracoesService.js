import { remuneracoesRepository } from "../repositories/remuneracoesRepository.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureRemuneracaoExists(id) {
  const remuneracao = await remuneracoesRepository.findById(id);

  if (!remuneracao) {
    throw new HttpError(404, "Item da tabela de remuneração não encontrado.");
  }

  return remuneracao;
}

export const remuneracoesService = {
  list(filters) {
    return remuneracoesRepository.findAll(filters);
  },

  async getById(id) {
    return ensureRemuneracaoExists(id);
  },

  async create(data) {
    const remuneracao = await remuneracoesRepository.findByNivel(data.nivel);

    if (remuneracao) {
      throw new HttpError(409, "Já existe um item com este nível.");
    }

    return remuneracoesRepository.create(data);
  },

  async update(id, data) {
    await ensureRemuneracaoExists(id);

    if (data.nivel) {
      const remuneracao = await remuneracoesRepository.findByNivel(data.nivel);

      if (remuneracao && remuneracao.id !== id) {
        throw new HttpError(409, "Já existe um item com este nível.");
      }
    }

    return remuneracoesRepository.update(id, data);
  },

  async inactivate(id) {
    await ensureRemuneracaoExists(id);
    return remuneracoesRepository.update(id, { status: "INATIVO" });
  }
};
