import { apontamentosRepository } from "../repositories/apontamentosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { projetosRepository } from "../repositories/projetosRepository.js";
import { tarefasRepository } from "../repositories/tarefasRepository.js";
import { financeDay, financeDate, todayFinanceDate } from "../utils/financeDates.js";

async function ensureApontamentoExists(id) {
  const record = await apontamentosRepository.findById(id);
  if (!record) throw new HttpError(404, "Apontamento não encontrado.");
  return record;
}
async function validate(data, previous = {}) {
  const merged = { ...previous, ...data };
  if (data.colaboradorId && !await colaboradoresRepository.findById(data.colaboradorId)) throw new HttpError(404, "Colaborador não encontrado.");
  if (data.projetoId && !await projetosRepository.findById(data.projetoId)) throw new HttpError(404, "Projeto não encontrado.");
  if (merged.tarefaId) {
    const task = await tarefasRepository.findById(merged.tarefaId);
    if (!task) throw new HttpError(404, "Tarefa não encontrada.");
    if (task.projetoId !== merged.projetoId) throw new HttpError(400, "A tarefa deve pertencer ao mesmo projeto do apontamento. Selecione outra tarefa ou remova o vínculo.");
    if (merged.tarefaId !== previous.tarefaId && (task.statusRegistro !== "ATIVO" || task.projeto.status !== "ATIVO")) throw new HttpError(409, "Selecione uma tarefa e um projeto ativos para vincular horas.");
  }
}
// Horas faturadas já foram cobradas do cliente: os dados que formam o custo ficam
// travados. O status pode voltar (ex.: FATURADO -> APROVADO) para permitir uma
// correção deliberada, em dois passos.
const STATUS_TRAVADO = "FATURADO";
const mesmoDia = (a, b) => new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
const camposTravados = {
  colaboradorId: (valor, anterior) => valor === anterior.colaboradorId,
  projetoId: (valor, anterior) => valor === anterior.projetoId,
  tarefaId: (valor, anterior) => (valor ?? null) === (anterior.tarefaId ?? null),
  data: (valor, anterior) => mesmoDia(valor, anterior.data),
  horas: (valor, anterior) => Number(valor) === Number(anterior.horas),
  descricao: (valor, anterior) => String(valor).trim() === String(anterior.descricao ?? "").trim()
};

function ensureEditavel(anterior, data) {
  if (anterior.status !== STATUS_TRAVADO) return;
  const alterados = Object.keys(camposTravados).filter((campo) => data[campo] !== undefined && !camposTravados[campo](data[campo], anterior));
  if (alterados.length) {
    throw new HttpError(409, "Apontamento faturado não pode ser alterado: as horas já foram cobradas do cliente. Para corrigir, volte o status para Aprovado e salve antes de editar.");
  }
}

function ensureExcluivel(registro) {
  if (registro.status === STATUS_TRAVADO) {
    throw new HttpError(409, "Apontamento faturado não pode ser excluído: as horas já foram cobradas do cliente. Para corrigir, volte o status para Aprovado antes.");
  }
}

// Apontamento registra hora já trabalhada: data futura é erro de digitação e trava
// novas vigências financeiras do colaborador até aquela data.
const LIMITE_HORAS_DIA = 24;
const dataBr = (value) => financeDay(value).split("-").reverse().join("/");
const centesimos = (value) => Math.round(Number(value) * 100);

async function validateDiaEHoras(data, previous = {}) {
  const merged = { ...previous, ...data };
  const dataMudou = data.data !== undefined && (!previous.data || !mesmoDia(data.data, previous.data));
  if (dataMudou && financeDay(data.data) > financeDay(todayFinanceDate())) {
    throw new HttpError(400, `A data do apontamento não pode ser depois de hoje (${dataBr(todayFinanceDate())}).`);
  }
  const somaMudou = dataMudou
    || (data.colaboradorId !== undefined && data.colaboradorId !== previous.colaboradorId)
    || (data.horas !== undefined && centesimos(data.horas) !== centesimos(previous.horas ?? 0));
  if (!somaMudou) return;
  const outras = await apontamentosRepository.sumHorasNoDia(merged.colaboradorId, financeDate(merged.data), previous.id);
  if (centesimos(outras) + centesimos(merged.horas) > LIMITE_HORAS_DIA * 100) {
    throw new HttpError(400, `O colaborador passaria de ${LIMITE_HORAS_DIA} h em ${dataBr(merged.data)}: já existem ${Number(outras)} h lançadas nesse dia.`);
  }
}

export const apontamentosService = {
  list(filters) { return apontamentosRepository.findAll(filters); },
  getById: ensureApontamentoExists,
  async create(data) {
    await validate(data);
    await validateDiaEHoras(data);
    return apontamentosRepository.create(data);
  },
  async update(id, data) {
    const previous = await ensureApontamentoExists(id);
    ensureEditavel(previous, data);
    await validate(data, previous);
    await validateDiaEHoras(data, previous);
    return apontamentosRepository.update(id, data);
  },
  async remove(id) {
    const registro = await ensureApontamentoExists(id);
    ensureExcluivel(registro);
    return apontamentosRepository.delete(id);
  }
};
