import { clientesRepository } from "../repositories/clientesRepository.js";
import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { projetosRepository } from "../repositories/projetosRepository.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureProjetoExists(id) {
  const projeto = await projetosRepository.findById(id);

  if (!projeto) {
    throw new HttpError(404, "Projeto não encontrado.");
  }

  return projeto;
}

async function ensureClienteAtivo(clienteId) {
  const cliente = await clientesRepository.findById(clienteId);

  if (!cliente) {
    throw new HttpError(404, "Cliente não encontrado.");
  }

  if (cliente.status !== "ATIVO") {
    throw new HttpError(400, "Não é possível vincular projeto a cliente inativo.");
  }

  return cliente;
}

function ensureProjetoAtivo(projeto) {
  if (projeto.status !== "ATIVO") {
    throw new HttpError(400, "Não é possível alterar equipe de projeto inativo.");
  }
}

async function ensureColaboradorAtivo(colaboradorId) {
  const colaborador = await colaboradoresRepository.findById(colaboradorId);

  if (!colaborador) {
    throw new HttpError(404, "Colaborador não encontrado.");
  }

  if (colaborador.status !== "ATIVO") {
    throw new HttpError(400, "Não é possível vincular colaborador inativo a um projeto.");
  }

  return colaborador;
}

async function ensureVinculoDoProjeto(projetoId, vinculoId) {
  const vinculo = await projetosRepository.findTeamMemberById(vinculoId);

  if (!vinculo || vinculo.projetoId !== projetoId) {
    throw new HttpError(404, "Vínculo de equipe não encontrado para este projeto.");
  }

  return vinculo;
}

function ensurePeriodoValido(dataEntrada, dataSaida) {
  if (dataSaida && dataEntrada && dataSaida < dataEntrada) {
    throw new HttpError(400, "Data de saída não pode ser anterior à data de entrada.");
  }
}

export const projetosService = {
  list(filters) {
    return projetosRepository.findAll(filters);
  },

  async getById(id) {
    return ensureProjetoExists(id);
  },

  async create(data) {
    await ensureClienteAtivo(data.clienteId);
    return projetosRepository.create(data);
  },

  async update(id, data) {
    await ensureProjetoExists(id);

    if (data.clienteId) {
      await ensureClienteAtivo(data.clienteId);
    }

    return projetosRepository.update(id, data);
  },

  async inactivate(id) {
    await ensureProjetoExists(id);
    return projetosRepository.update(id, { status: "INATIVO" });
  },

  async listTeam(projetoId) {
    await ensureProjetoExists(projetoId);
    return projetosRepository.findTeamByProject(projetoId);
  },

  async addTeamMember(projetoId, data) {
    const projeto = await ensureProjetoExists(projetoId);
    ensureProjetoAtivo(projeto);

    await ensureColaboradorAtivo(data.colaboradorId);

    const activeTeamMember = await projetosRepository.findActiveTeamMember(projetoId, data.colaboradorId);

    if (activeTeamMember) {
      throw new HttpError(409, "Este colaborador já está ativo na equipe do projeto.");
    }

    return projetosRepository.addTeamMember({
      projetoId,
      colaboradorId: data.colaboradorId,
      papel: data.papel,
      dataEntrada: data.dataEntrada
    });
  },

  async updateTeamMember(projetoId, vinculoId, data) {
    const projeto = await ensureProjetoExists(projetoId);
    ensureProjetoAtivo(projeto);

    const vinculo = await ensureVinculoDoProjeto(projetoId, vinculoId);
    const nextDataEntrada = data.dataEntrada ?? vinculo.dataEntrada;
    const nextDataSaida = data.dataSaida === undefined ? vinculo.dataSaida : data.dataSaida;

    ensurePeriodoValido(nextDataEntrada, nextDataSaida);

    return projetosRepository.updateTeamMember(vinculoId, data);
  },

  async removeTeamMember(projetoId, vinculoId) {
    const projeto = await ensureProjetoExists(projetoId);
    ensureProjetoAtivo(projeto);

    const vinculo = await ensureVinculoDoProjeto(projetoId, vinculoId);

    if (vinculo.dataSaida) {
      return vinculo;
    }

    const dataSaida = new Date();

    return projetosRepository.updateTeamMember(vinculoId, {
      dataSaida: dataSaida < vinculo.dataEntrada ? vinculo.dataEntrada : dataSaida
    });
  }
};
