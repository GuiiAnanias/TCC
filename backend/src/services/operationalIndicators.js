export const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const ratio = (numerator, denominator) => denominator > 0 ? round(numerator / denominator * 100) : null;

export function operationalIndicators(projects) {
  const tasks = projects.flatMap((project) => (project.tarefas ?? []).map((task) => ({ ...task, projetoId: project.id, projeto: project.nome })));
  const allTasks = new Map(projects.flatMap((project) => (project.tarefas ?? []).map((task) => [task.id, task])));
  const entries = projects.flatMap((project) => project.apontamentos);
  const counted = tasks.filter((task) => task.status !== "CANCELADA");
  const completed = counted.filter((task) => task.status === "CONCLUIDA");
  const withoutHours = completed.filter((task) => !(task.apontamentos ?? []).some((entry) => Number(entry.horas) > 0));
  const withoutEstimate = counted.filter((task) => task.minutosEstimados == null);
  const comparable = completed.filter((task) => Number(task.minutosEstimados) > 0 &&
    (task.apontamentos ?? []).some((entry) => Number(entry.horas) > 0));
  const estimated = comparable.reduce((sum, task) => sum + Number(task.minutosEstimados) / 60, 0);
  const actualComparable = comparable.reduce((sum, task) => sum + task.apontamentos.reduce((total, entry) => total + Number(entry.horas), 0), 0);
  const hours = entries.reduce((total, entry) => total + Number(entry.horas), 0);
  const known = entries.filter((entry) => allTasks.has(entry.tarefaId));
  const unknownHours = entries.filter((entry) => !allTasks.has(entry.tarefaId)).reduce((total, entry) => total + Number(entry.horas), 0);
  const corrections = known.filter((entry) => allTasks.get(entry.tarefaId).correcao).reduce((total, entry) => total + Number(entry.horas), 0);
  const partialPeople = false;
  const estimateAssertiveness = ratio(estimated, actualComparable);
  const result = {
    tarefas: counted.length, tarefasCanceladas: tasks.length - counted.length,
    tarefasConcluidas: completed.length, tarefasSemHoras: withoutHours.length,
    tarefasSemEstimativa: withoutEstimate.length, tarefasComparaveis: comparable.length,
    minutosEstimadosComparaveis: comparable.reduce((total, task) => total + Number(task.minutosEstimados), 0),
    horasEstimadasComparaveis: round(estimated), horasRealizadasComparaveis: round(actualComparable),
    horasCorrecao: round(corrections), horasSemTarefa: round(unknownHours),
    correcoesParciais: unknownHours > 0,
    percentualCorrecoes: known.length ? ratio(corrections, hours) : null,
    assertividadeEstimativas: partialPeople ? null : estimateAssertiveness,
    assertividadeTarefasContexto: partialPeople ? estimateAssertiveness : null,
    percentualTarefasSemHoras: ratio(withoutHours.length, completed.length),
    percentualTarefasSemEstimativa: ratio(withoutEstimate.length, counted.length),
    motivos: {
      percentualCorrecoes: !known.length ? "Sem horas vinculadas a tarefas para identificar correções." : unknownHours > 0 ? "Parcial: há horas sem tarefa, cuja classificação de correção é desconhecida." : null,
      assertividadeEstimativas: partialPeople ? "A estimativa da tarefa não é dividida entre pessoas. Consulte o contexto das tarefas completas." : !comparable.length ? "Sem tarefas concluídas com estimativa e horas integrais no recorte." : null,
      assertividadeTarefasContexto: !comparable.length ? "Sem tarefas concluídas com estimativa e horas integrais no recorte." : null,
      percentualTarefasSemHoras: !completed.length ? "Sem tarefas concluídas neste recorte." : null,
      percentualTarefasSemEstimativa: !counted.length ? "Sem tarefas elegíveis neste recorte." : null
    }
  };
  return { indicadores: result };
}
