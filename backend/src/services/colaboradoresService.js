/**
 * [SERVICE][REGRA] Regras de colaboradores: e-mail único e inativação sem apagar histórico.
 */

import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { ErroHttp } from "../utils/ErroHttp.js";

async function ensureColaboradorExists(id) {
  const colaborador = await colaboradoresRepository.findById(id);

  if (!colaborador) {
    throw new ErroHttp(404, "Colaborador não encontrado.");
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

  // [REGRA][ERRO] E-mail já usado por outro colaborador: 409.
  async create(data) {
    const colaborador = await colaboradoresRepository.findByEmail(data.email);

    if (colaborador) {
      throw new ErroHttp(409, "Já existe um colaborador com este e-mail.");
    }

    return colaboradoresRepository.create(data);
  },

  async update(id, data) {
    await ensureColaboradorExists(id);

    if (data.email) {
      const colaborador = await colaboradoresRepository.findByEmail(data.email);

      if (colaborador && colaborador.id !== id) {
        throw new ErroHttp(409, "Já existe um colaborador com este e-mail.");
      }
    }

    return colaboradoresRepository.update(id, data);
  },

  // [REGRA] Marca como Inativo; horas, equipes e vigências ficam no histórico.
  async inactivate(id) {
    await ensureColaboradorExists(id);
    return colaboradoresRepository.update(id, { status: "INATIVO" });
  },
};
