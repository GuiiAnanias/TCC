import { clientesRepository } from "../repositories/clientesRepository.js";
import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { projetosRepository } from "../repositories/projetosRepository.js";
import { financeDate, todayFinanceDate } from "../utils/financeDates.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureProjetoExists(id, db) {
  const projeto = await projetosRepository.findById(id, db);

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

async function ensureColaboradorAtivo(colaboradorId, db) {
  const colaborador = await colaboradoresRepository.findById(colaboradorId, db);

  if (!colaborador) {
    throw new HttpError(404, "Colaborador não encontrado.");
  }

  if (colaborador.status !== "ATIVO") {
    throw new HttpError(400, "Não é possível vincular colaborador inativo a um projeto.");
  }

  return colaborador;
}

async function ensureVinculoDoProjeto(projetoId, vinculoId, db) {
  const vinculo = await projetosRepository.findTeamMemberById(vinculoId, db);

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

async function ensureSemSobreposicao(projetoId, colaboradorId, entrada, saida, exceptId, db) {
  if (
    await projetosRepository.findOverlappingTeamMember(
      projetoId,
      colaboradorId,
      entrada,
      saida,
      exceptId,
      db,
    )
  )
    throw new HttpError(
      409,
      "Já existe participação deste colaborador no período informado. Confira as datas de entrada e saída.",
    );
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
    return projetosRepository.transaction(async (db) => {
      const projeto = await ensureProjetoExists(projetoId, db);
      ensureProjetoAtivo(projeto);

      await ensureColaboradorAtivo(data.colaboradorId, db);

      const entrada = financeDate(data.dataEntrada);
      await ensureSemSobreposicao(projetoId, data.colaboradorId, entrada, null, undefined, db);

      return projetosRepository.addTeamMember(
        {
          projetoId,
          colaboradorId: data.colaboradorId,
          papel: data.papel,
          dataEntrada: entrada,
        },
        db,
      );
    });
  },

  async updateTeamMember(projetoId, vinculoId, data) {
    return projetosRepository.transaction(async (db) => {
      const projeto = await ensureProjetoExists(projetoId, db);
      ensureProjetoAtivo(projeto);

      const vinculo = await ensureVinculoDoProjeto(projetoId, vinculoId, db);
      if (data.papel && data.papel !== vinculo.papel) {
        if (vinculo.dataSaida)
          throw new HttpError(400, "O papel de uma participação encerrada não pode ser alterado.");
        if (!data.dataVigencia)
          throw new HttpError(400, "Informe a data de vigência do novo papel.");
        if (data.dataEntrada !== undefined || data.dataSaida !== undefined)
          throw new HttpError(400, "Altere o papel separadamente das datas de participação.");
        const day = financeDate(data.dataVigencia);
        if (day <= new Date(vinculo.dataEntrada.toISOString().slice(0, 10))) {
          throw new HttpError(
            400,
            "A vigência do novo papel deve começar após a entrada do vínculo atual.",
          );
        }
        await ensureSemSobreposicao(projetoId, vinculo.colaboradorId, day, null, vinculo.id, db);
        return projetosRepository.changeTeamRole(vinculo, data.papel, day, db);
      }
      const nextDataEntrada = financeDate(data.dataEntrada ?? vinculo.dataEntrada);
      const nextDataSaida =
        data.dataSaida === undefined
          ? vinculo.dataSaida
          : data.dataSaida && financeDate(data.dataSaida);

      ensurePeriodoValido(nextDataEntrada, nextDataSaida);

      await ensureSemSobreposicao(
        projetoId,
        vinculo.colaboradorId,
        nextDataEntrada,
        nextDataSaida,
        vinculo.id,
        db,
      );
      const { dataVigencia, ...changes } = data;
      if (!Object.keys(changes).length)
        throw new HttpError(400, "Informe uma alteração no vínculo.");
      return projetosRepository.updateTeamMember(
        vinculoId,
        { ...changes, dataEntrada: nextDataEntrada, dataSaida: nextDataSaida },
        db,
      );
    });
  },

  async removeTeamMember(projetoId, vinculoId) {
    return projetosRepository.transaction(async (db) => {
      const projeto = await ensureProjetoExists(projetoId, db);
      ensureProjetoAtivo(projeto);

      const vinculo = await ensureVinculoDoProjeto(projetoId, vinculoId, db);

      if (vinculo.dataSaida) {
        return vinculo;
      }

      const dataSaida = todayFinanceDate();

      return projetosRepository.updateTeamMember(
        vinculoId,
        {
          dataSaida: dataSaida < vinculo.dataEntrada ? vinculo.dataEntrada : dataSaida,
        },
        db,
      );
    });
  },
};
