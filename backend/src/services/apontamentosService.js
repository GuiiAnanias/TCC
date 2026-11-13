/**
 * [SERVICE][REGRA] Regras dos apontamentos de horas: colaborador e projeto ativos, tarefa do mesmo
 * projeto, equipe vigente na data, data até hoje, limite de 24 h por colaborador no dia e bloqueio
 * de edição de horas faturadas.
 */

import { apontamentosRepository } from "../repositories/apontamentosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { projetosRepository } from "../repositories/projetosRepository.js";
import { tarefasRepository } from "../repositories/tarefasRepository.js";
import { financeDay, financeDate, todayFinanceDate } from "../utils/financeDates.js";

async function ensureApontamentoExists(id, db) {
  const record = await apontamentosRepository.findById(id, db);
  if (!record) throw new HttpError(404, "Apontamento não encontrado.");
  return record;
}
// [REGRA] Confere colaborador, projeto e tarefa do apontamento (novo ou editado).
async function validate(data, previous = {}, db) {
  const merged = { ...previous, ...data };
  const colaboradorId =
    merged.colaboradorId !== previous.colaboradorId ? merged.colaboradorId : null;
  const projetoId = merged.projetoId !== previous.projetoId ? merged.projetoId : null;
  await apontamentosRepository.lockReferences({ colaboradorId, projetoId }, db);
  if (colaboradorId) {
    const person = await colaboradoresRepository.findById(colaboradorId, db);
    if (!person) throw new HttpError(404, "Colaborador não encontrado.");
    if (person.status !== "ATIVO")
      throw new HttpError(409, "Selecione um colaborador ativo para lançar horas.");
  }
  if (projetoId) {
    const project = await projetosRepository.findById(projetoId, db);
    if (!project) throw new HttpError(404, "Projeto não encontrado.");
    if (project.status !== "ATIVO")
      throw new HttpError(409, "Selecione um projeto ativo para lançar horas.");
  }
  // Novas horas (ou transferência para outro projeto) exigem uma equipe válida
  // na data trabalhada. Correções no próprio projeto preservam o fluxo histórico.
  if (
    !previous.id ||
    projetoId ||
    (data.data !== undefined && financeDay(merged.data) !== financeDay(previous.data))
  ) {
    if (
      !(await projetosRepository.hasOperationalTeam(merged.projetoId, financeDate(merged.data), db))
    )
      throw new HttpError(
        409,
        "Vincule ao menos um colaborador ativo à equipe do projeto, com participação na data das horas, antes de lançar apontamentos.",
      );
  }
  if (merged.tarefaId) {
    const task = await tarefasRepository.findById(merged.tarefaId, db);
    if (!task) throw new HttpError(404, "Tarefa não encontrada.");
    if (task.projetoId !== merged.projetoId)
      throw new HttpError(
        400,
        "A tarefa deve pertencer ao mesmo projeto do apontamento. Selecione outra tarefa ou remova o vínculo.",
      );
    if (
      merged.tarefaId !== previous.tarefaId &&
      (task.statusRegistro !== "ATIVO" || task.projeto.status !== "ATIVO")
    )
      throw new HttpError(409, "Selecione uma tarefa e um projeto ativos para vincular horas.");
  }
}
// Horas faturadas já foram cobradas do cliente: os dados que formam o custo ficam
// travados. O status pode voltar (ex.: FATURADO -> APROVADO) para permitir uma
// correção deliberada, em dois passos.
const STATUS_TRAVADO = "FATURADO";
const mesmoDia = (a, b) =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
// [REGRA] Campos que não podem mudar num apontamento Faturado (só o status pode).
const camposTravados = {
  colaboradorId: (valor, anterior) => valor === anterior.colaboradorId,
  projetoId: (valor, anterior) => valor === anterior.projetoId,
  tarefaId: (valor, anterior) => (valor ?? null) === (anterior.tarefaId ?? null),
  data: (valor, anterior) => mesmoDia(valor, anterior.data),
  horas: (valor, anterior) => Number(valor) === Number(anterior.horas),
  descricao: (valor, anterior) => String(valor).trim() === String(anterior.descricao ?? "").trim(),
};

// [REGRA][ERRO] Apontamento faturado: recusa mudar horas, data, projeto etc. e orienta voltar para
// Aprovado.
function ensureEditavel(anterior, data) {
  if (anterior.status !== STATUS_TRAVADO) return;
  const alterados = Object.keys(camposTravados).filter(
    (campo) => data[campo] !== undefined && !camposTravados[campo](data[campo], anterior),
  );
  if (alterados.length) {
    throw new HttpError(
      409,
      "Apontamento faturado não pode ser alterado: as horas já foram cobradas do cliente. Para corrigir, volte o status para Aprovado e salve antes de editar.",
    );
  }
}

// [REGRA][ERRO] Apontamento faturado não pode ser excluído.
function ensureExcluivel(registro) {
  if (registro.status === STATUS_TRAVADO) {
    throw new HttpError(
      409,
      "Apontamento faturado não pode ser excluído: as horas já foram cobradas do cliente. Para corrigir, volte o status para Aprovado antes.",
    );
  }
}

// Apontamento registra hora já trabalhada: data futura é erro de digitação e trava
// novas vigências financeiras do colaborador até aquela data.
const LIMITE_HORAS_DIA = 24;
const dataBr = (value) => financeDay(value).split("-").reverse().join("/");
const centesimos = (value) => Math.round(Number(value) * 100);

// [REGRA] Data não pode ser futura e a soma das horas do colaborador no dia não pode passar de 24
// h.
async function validateDiaEHoras(data, previous = {}, db) {
  const merged = { ...previous, ...data };
  const dataMudou =
    data.data !== undefined && (!previous.data || !mesmoDia(data.data, previous.data));
  if (dataMudou && financeDay(data.data) > financeDay(todayFinanceDate())) {
    throw new HttpError(
      400,
      `A data do apontamento não pode ser depois de hoje (${dataBr(todayFinanceDate())}).`,
    );
  }
  const somaMudou =
    dataMudou ||
    (data.colaboradorId !== undefined && data.colaboradorId !== previous.colaboradorId) ||
    (data.horas !== undefined && centesimos(data.horas) !== centesimos(previous.horas ?? 0));
  if (!somaMudou) return;
  const outras = await apontamentosRepository.sumHorasNoDia(
    merged.colaboradorId,
    financeDate(merged.data),
    previous.id,
    db,
  );
  if (centesimos(outras) + centesimos(merged.horas) > LIMITE_HORAS_DIA * 100) {
    throw new HttpError(
      400,
      `O colaborador passaria de ${LIMITE_HORAS_DIA} h em ${dataBr(merged.data)}: já existem ${Number(outras)} h lançadas nesse dia.`,
    );
  }
}

export const apontamentosService = {
  list(filters) {
    return apontamentosRepository.findAll(filters);
  },
  getById: ensureApontamentoExists,
  // [TRANSACAO] Valida e grava dentro de uma transação Serializable (ver apontamentosRepository).
  async create(data) {
    return apontamentosRepository.transaction(async (db) => {
      await validate(data, {}, db);
      await validateDiaEHoras(data, {}, db);
      return apontamentosRepository.create(data, db);
    });
  },
  async update(id, data) {
    return apontamentosRepository.transaction(async (db) => {
      const previous = await ensureApontamentoExists(id, db);
      ensureEditavel(previous, data);
      await validate(data, previous, db);
      await validateDiaEHoras(data, previous, db);
      return apontamentosRepository.update(id, data, db);
    });
  },
  async remove(id) {
    return apontamentosRepository.transaction(async (db) => {
      const registro = await ensureApontamentoExists(id, db);
      ensureExcluivel(registro);
      return apontamentosRepository.delete(id, db);
    });
  },
};
