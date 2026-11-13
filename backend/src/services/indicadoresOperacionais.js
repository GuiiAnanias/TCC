/**
 * [REGRA] Indicadores operacionais: percentual de correções, assertividade das estimativas, tarefas
 * concluídas sem horas e tarefas sem estimativa, com o motivo quando não há base de cálculo.
 */

export const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const ratio = (numerator, denominator) =>
  denominator > 0 ? round((numerator / denominator) * 100) : null;
const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);
export const hasPeriod = (filters) => Boolean(filters.dataInicio || filters.dataFim);
export function withinPeriod(value, filters) {
  const date = day(value);
  return Boolean(
    date &&
    (!filters.dataInicio || date >= day(filters.dataInicio)) &&
    (!filters.dataFim || date <= day(filters.dataFim)),
  );
}
function matchesPerson(person, id, filters) {
  return (
    (!filters.colaboradorId || id === filters.colaboradorId) &&
    (!filters.equipe || person?.departamento === filters.equipe)
  );
}
export function entryInScope(entry, filters) {
  return (
    matchesPerson(entry.colaborador, entry.colaboradorId, filters) &&
    (!hasPeriod(filters) || withinPeriod(entry.data, filters))
  );
}
export function taskInScope(task, filters) {
  if (filters.sprintId && task.sprintId !== filters.sprintId) return false;
  const entries = task.apontamentos ?? [];
  if (
    (filters.colaboradorId || filters.equipe) &&
    !(task.responsaveis ?? []).some((owner) =>
      matchesPerson(owner.colaborador, owner.colaboradorId, filters),
    ) &&
    !entries.some((entry) => matchesPerson(entry.colaborador, entry.colaboradorId, filters))
  )
    return false;
  return (
    !hasPeriod(filters) ||
    withinPeriod(task.dataInicio, filters) ||
    withinPeriod(task.dataConclusao, filters) ||
    entries.some((entry) => entryInScope(entry, filters))
  );
}

// [REGRA] Calcula os quatro indicadores para os projetos e filtros do recorte.
export function operationalIndicators(projects, filters = {}) {
  const tasks = projects.flatMap((project) =>
    (project.tarefas ?? [])
      .filter((task) => taskInScope(task, filters))
      .map((task) => ({ ...task, projetoId: project.id, projeto: project.nome })),
  );
  const allTasks = new Map(
    projects.flatMap((project) => (project.tarefas ?? []).map((task) => [task.id, task])),
  );
  const entries = projects.flatMap((project) => project.apontamentos);
  const counted = tasks.filter((task) => task.status !== "CANCELADA");
  const completed = counted.filter(
    (task) =>
      task.status === "CONCLUIDA" &&
      (!hasPeriod(filters) || withinPeriod(task.dataConclusao, filters)),
  );
  const withoutHours = completed.filter(
    (task) => !(task.apontamentos ?? []).some((entry) => Number(entry.horas) > 0),
  );
  const withoutEstimate = counted.filter((task) => task.minutosEstimados == null);
  const comparable = completed.filter(
    (task) =>
      Number(task.minutosEstimados) > 0 &&
      (task.apontamentos ?? []).some((entry) => Number(entry.horas) > 0) &&
      (!hasPeriod(filters) ||
        task.apontamentos.every((entry) => withinPeriod(entry.data, filters))),
  );
  const estimated = comparable.reduce((sum, task) => sum + Number(task.minutosEstimados) / 60, 0);
  const actualComparable = comparable.reduce(
    (sum, task) => sum + task.apontamentos.reduce((total, entry) => total + Number(entry.horas), 0),
    0,
  );
  const hours = entries.reduce((total, entry) => total + Number(entry.horas), 0);
  const known = entries.filter((entry) => allTasks.has(entry.tarefaId));
  const unknownHours = entries
    .filter((entry) => !allTasks.has(entry.tarefaId))
    .reduce((total, entry) => total + Number(entry.horas), 0);
  const corrections = known
    .filter((entry) => allTasks.get(entry.tarefaId).correcao)
    .reduce((total, entry) => total + Number(entry.horas), 0);
  const partialPeople = Boolean(filters.equipe || filters.colaboradorId);
  const estimateAssertiveness = ratio(estimated, actualComparable);
  const result = {
    tarefas: counted.length,
    tarefasCanceladas: tasks.length - counted.length,
    tarefasConcluidas: completed.length,
    tarefasSemHoras: withoutHours.length,
    tarefasSemEstimativa: withoutEstimate.length,
    tarefasComparaveis: comparable.length,
    minutosEstimadosComparaveis: comparable.reduce(
      (total, task) => total + Number(task.minutosEstimados),
      0,
    ),
    horasEstimadasComparaveis: round(estimated),
    horasRealizadasComparaveis: round(actualComparable),
    horasCorrecao: round(corrections),
    horasSemTarefa: round(unknownHours),
    correcoesParciais: unknownHours > 0,
    percentualCorrecoes: known.length ? ratio(corrections, hours) : null,
    assertividadeEstimativas: partialPeople ? null : estimateAssertiveness,
    assertividadeTarefasContexto: partialPeople ? estimateAssertiveness : null,
    percentualTarefasSemHoras: ratio(withoutHours.length, completed.length),
    percentualTarefasSemEstimativa: ratio(withoutEstimate.length, counted.length),
    motivos: {
      percentualCorrecoes: !known.length
        ? "Sem horas vinculadas a tarefas para identificar correções."
        : unknownHours > 0
          ? "Parcial: há horas sem tarefa, cuja classificação de correção é desconhecida."
          : null,
      assertividadeEstimativas: partialPeople
        ? "A estimativa da tarefa não é dividida entre pessoas. Consulte o contexto das tarefas completas."
        : !comparable.length
          ? "Sem tarefas concluídas com estimativa e horas integrais no recorte."
          : null,
      assertividadeTarefasContexto: !comparable.length
        ? "Sem tarefas concluídas com estimativa e horas integrais no recorte."
        : null,
      percentualTarefasSemHoras: !completed.length
        ? hasPeriod(filters)
          ? "Sem tarefas concluídas com data de conclusão no período selecionado."
          : "Sem tarefas concluídas neste recorte."
        : null,
      percentualTarefasSemEstimativa: !counted.length
        ? "Sem tarefas elegíveis neste recorte."
        : null,
    },
  };
  const comparableIds = new Set(comparable.map((task) => task.id));
  const withoutHourIds = new Set(withoutHours.map((task) => task.id));
  const taskRows = tasks.map((task) => ({
    id: task.id,
    projetoId: task.projetoId,
    projeto: task.projeto,
    titulo: task.titulo,
    sprintId: task.sprintId,
    sprint: task.sprint?.nome ?? null,
    status: task.status,
    statusRegistro: task.statusRegistro,
    correcao: task.correcao,
    minutosEstimados: task.minutosEstimados,
    dataInicio: task.dataInicio,
    dataConclusao: task.dataConclusao,
    responsaveis: (task.responsaveis ?? []).map((owner) => ({
      id: owner.colaboradorId,
      nome: owner.colaborador?.nomeCompleto ?? "Colaborador",
    })),
    horasTotais: round(
      (task.apontamentos ?? []).reduce((sum, entry) => sum + Number(entry.horas), 0),
    ),
    horasNoRecorte: round(
      (task.apontamentos ?? [])
        .filter((entry) => entryInScope(entry, filters))
        .reduce((sum, entry) => sum + Number(entry.horas), 0),
    ),
    comparavel: comparableIds.has(task.id),
    semHoras: withoutHourIds.has(task.id),
  }));
  const occurrences = [];
  for (const task of withoutEstimate)
    occurrences.push({
      tipo: "SEM_ESTIMATIVA",
      projetoId: task.projetoId,
      projeto: task.projeto,
      tarefaId: task.id,
      tarefa: task.titulo,
      descricao: "Tarefa sem estimativa.",
    });
  for (const task of withoutHours)
    occurrences.push({
      tipo: "CONCLUIDA_SEM_HORAS",
      projetoId: task.projetoId,
      projeto: task.projeto,
      tarefaId: task.id,
      tarefa: task.titulo,
      descricao: "Tarefa concluída sem apontamento de horas.",
    });
  return { indicadores: result, tarefas: taskRows, ocorrencias: occurrences };
}
