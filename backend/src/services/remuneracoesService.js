/**
 * [SERVICE][REGRA] Regras da tabela de remuneração: nível único e inativação. Mudar o valor/hora de
 * um item vale só para novas vigências; as já criadas guardam o valor da época.
 */

import { remuneracoesRepository } from "../repositories/remuneracoesRepository.js";
import { ErroHttp } from "../utils/ErroHttp.js";
import { niveisRemuneracao } from "../schemas/opcoesCadastro.js";

async function ensureRemuneracaoExists(id) {
  const remuneracao = await remuneracoesRepository.findById(id);

  if (!remuneracao) {
    throw new ErroHttp(404, "Item da tabela de remuneração não encontrado.");
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
      throw new ErroHttp(409, "Já existe um item com este nível.");
    }

    return remuneracoesRepository.create(data);
  },

  async update(id, data) {
    const current = await ensureRemuneracaoExists(id);

    if (data.nivel) {
      if (data.nivel !== current.nivel && !niveisRemuneracao.includes(data.nivel)) {
        throw new ErroHttp(
          400,
          "Selecione um nível de remuneração válido. O nome antigo só pode ser mantido no próprio registro.",
        );
      }
      const remuneracao = await remuneracoesRepository.findByNivel(data.nivel);

      if (remuneracao && remuneracao.id !== id) {
        throw new ErroHttp(409, "Já existe um item com este nível.");
      }
    }

    return remuneracoesRepository.update(id, data);
  },

  async inactivate(id) {
    await ensureRemuneracaoExists(id);
    return remuneracoesRepository.update(id, { status: "INATIVO" });
  },
};
