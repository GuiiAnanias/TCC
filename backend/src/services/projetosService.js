/**
 * [SERVICE][REGRA] Regras de projetos e da equipe: cliente ativo, projeto ativo para mexer na
 * equipe, colaborador ativo, períodos sem sobreposição e troca de papel com data.
 */

import { clientesRepository } from "../repositories/clientesRepository.js";
import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { projetosRepository } from "../repositories/projetosRepository.js";
import { financeDate, todayFinanceDate } from "../utils/datasFinanceiras.js";
import { ErroHttp } from "../utils/ErroHttp.js";

// Estados de projeto finalizado: reativar exige confirmação (ver update).
export const ESTADOS_FINALIZADOS = ["CANCELADO", "ENCERRADO"];

async function ensureProjetoExists(id, db) {
  const projeto = await projetosRepository.findById(id, db);

  if (!projeto) {
    throw new ErroHttp(404, "Projeto não encontrado.");
  }

  return projeto;
}

// [REGRA] Projeto novo (ou troca de cliente) só com cliente ativo.
async function ensureClienteAtivo(clienteId, db) {
  const cliente = await clientesRepository.findById(clienteId, db);

  if (!cliente) {
    throw new ErroHttp(404, "Cliente não encontrado.");
  }

  if (cliente.status !== "ATIVO") {
    throw new ErroHttp(400, "Não é possível vincular projeto a cliente inativo.");
  }

  return cliente;
}

// [REGRA] Alterações de equipe exigem projeto Ativo.
function ensureProjetoAtivo(projeto) {
  if (projeto.status !== "ATIVO") {
    throw new ErroHttp(400, "Reative o projeto para alterar a equipe.");
  }
}

async function ensureColaboradorAtivo(colaboradorId, db) {
  const colaborador = await colaboradoresRepository.findById(colaboradorId, db);

  if (!colaborador) {
    throw new ErroHttp(404, "Colaborador não encontrado.");
  }

  if (colaborador.status !== "ATIVO") {
    throw new ErroHttp(400, "Não é possível vincular colaborador inativo a um projeto.");
  }

  return colaborador;
}

async function ensureVinculoDoProjeto(projetoId, vinculoId, db) {
  const vinculo = await projetosRepository.findTeamMemberById(vinculoId, db);

  if (!vinculo || vinculo.projetoId !== projetoId) {
    throw new ErroHttp(404, "Vínculo de equipe não encontrado para este projeto.");
  }

  return vinculo;
}

// [VALIDACAO] Saída não pode ser antes da entrada.
function ensurePeriodoValido(dataEntrada, dataSaida) {
  if (dataSaida && dataEntrada && dataSaida < dataEntrada) {
    throw new ErroHttp(400, "Data de saída não pode ser anterior à data de entrada.");
  }
}

// [REGRA] A mesma pessoa não pode ter duas participações com períodos sobrepostos no mesmo projeto.
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
    throw new ErroHttp(
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

  // [REGRA][TRANSACAO] Cria o projeto e, se informada, a equipe inicial, na mesma transação.
  async create(data) {
    const { equipeInicial = [], ...project } = data;
    return projetosRepository.transaction(async (db) => {
      await ensureClienteAtivo(project.clienteId, db);
      for (const member of equipeInicial) await ensureColaboradorAtivo(member.colaboradorId, db);
      return projetosRepository.create(
        {
          ...project,
          equipe: {
            create: equipeInicial.map((member) => ({
              ...member,
              dataEntrada: financeDate(member.dataEntrada),
            })),
          },
        },
        db,
      );
    });
  },

  async update(id, { confirmarReativacao, ...data }) {
    const previous = await ensureProjetoExists(id);

    // [REGRA] Pausado volta para Ativo direto. Cancelado e Encerrado só voltam com confirmação
    // explícita: a reativação reabre horas, tarefas, sprints e equipe de um projeto finalizado.
    if (
      data.status === "ATIVO" &&
      ESTADOS_FINALIZADOS.includes(previous.status) &&
      !confirmarReativacao
    ) {
      throw new ErroHttp(
        409,
        `Este projeto está ${previous.status === "CANCELADO" ? "cancelado" : "encerrado"}. Confirme a reativação para voltar a aceitar horas, tarefas, sprints e alterações na equipe.`,
        { codigo: "REATIVACAO_SEM_CONFIRMACAO", statusAnterior: previous.status },
      );
    }

    if (data.clienteId && data.clienteId !== previous.clienteId) {
      await ensureClienteAtivo(data.clienteId);
    }

    return projetosRepository.update(id, data);
  },

  // [REGRA] "Excluir" encerra o projeto (status Encerrado).
  async close(id) {
    await ensureProjetoExists(id);
    return projetosRepository.update(id, { status: "ENCERRADO" });
  },

  async listTeam(projetoId) {
    await ensureProjetoExists(projetoId);
    return projetosRepository.findTeamByProject(projetoId);
  },

  // [REGRA] Vincula colaborador ativo a projeto ativo, conferindo sobreposição de período.
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

  // [REGRA] Troca de papel a partir de uma data ou correção das datas da participação.
  async updateTeamMember(projetoId, vinculoId, data) {
    return projetosRepository.transaction(async (db) => {
      const projeto = await ensureProjetoExists(projetoId, db);
      ensureProjetoAtivo(projeto);

      const vinculo = await ensureVinculoDoProjeto(projetoId, vinculoId, db);
      if (data.papel && data.papel !== vinculo.papel) {
        if (vinculo.dataSaida)
          throw new ErroHttp(400, "O papel de uma participação encerrada não pode ser alterado.");
        if (!data.dataVigencia)
          throw new ErroHttp(400, "Informe a data de vigência do novo papel.");
        if (data.dataEntrada !== undefined || data.dataSaida !== undefined)
          throw new ErroHttp(400, "Altere o papel separadamente das datas de participação.");
        const day = financeDate(data.dataVigencia);
        if (day <= new Date(vinculo.dataEntrada.toISOString().slice(0, 10))) {
          throw new ErroHttp(
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
        throw new ErroHttp(400, "Informe uma alteração no vínculo.");
      return projetosRepository.updateTeamMember(
        vinculoId,
        { ...changes, dataEntrada: nextDataEntrada, dataSaida: nextDataSaida },
        db,
      );
    });
  },

  // [REGRA] Encerra a participação hoje; o histórico continua.
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
