import { apontamentosRepository } from "../repositories/apontamentosRepository.js";
import { HttpError } from "../utils/HttpError.js";
import { colaboradoresRepository } from "../repositories/colaboradoresRepository.js";
import { projetosRepository } from "../repositories/projetosRepository.js";
import { tarefasRepository } from "../repositories/tarefasRepository.js";

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
export const apontamentosService = {
  list(filters) { return apontamentosRepository.findAll(filters); },
  getById: ensureApontamentoExists,
  async create(data) { await validate(data); return apontamentosRepository.create(data); },
  async update(id, data) { const previous = await ensureApontamentoExists(id); await validate(data, previous); return apontamentosRepository.update(id, data); },
  async remove(id) { await ensureApontamentoExists(id); return apontamentosRepository.delete(id); }
};
