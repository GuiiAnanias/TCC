/**
 * [COMPONENTE] Partes do dashboard reaproveitadas no geral e nos individuais: cartões dos
 * indicadores operacionais, tabela da auditoria operacional e tabela de tarefas dos indicadores.
 */

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PaginacaoTabela, usePaginacao } from "../comum/PaginacaoTabela.jsx";
import { TIPOS_PENDENCIA_CUSTO, linkDaPendencia } from "../../utils/pendencias.js";

export const number = (value) =>
  Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export const money = (value) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const percent = (value) => (value == null ? "Indisponível" : `${number(value)}%`);
export const date = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
export const taskStatus = {
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};
export const issueLabels = {
  SEM_REMUNERACAO: "Sem remuneração",
  SEM_VINCULO: "Sem participação na equipe",
  SEM_TAREFA: "Horas sem tarefa",
  SEM_ESTIMATIVA: "Tarefa sem estimativa",
  CONCLUIDA_SEM_HORAS: "Concluída sem horas",
};
export function taskUrl(row) {
  return `/tarefas?projetoId=${row.projetoId}&tarefaId=${row.tarefaId ?? row.id}`;
}

// [TELA] Quatro indicadores operacionais com o motivo quando não há base de cálculo.
export function OperationalMetrics({ summary, loading = false, context = false }) {
  const cards = [
    {
      key: "percentualCorrecoes",
      label: "Correções (horas)",
      value: summary?.percentualCorrecoes,
      hint: `${number(summary?.horasCorrecao)} h de ${number(summary?.horas)} h${summary?.correcoesParciais ? " · parcial" : ""}`,
    },
    {
      key: "assertividadeEstimativas",
      label: context ? "Assertividade das tarefas (contexto)" : "Assertividade das estimativas",
      value: context ? summary?.assertividadeTarefasContexto : summary?.assertividadeEstimativas,
      hint: `${summary?.tarefasComparaveis ?? 0} ${summary?.tarefasComparaveis === 1 ? "tarefa concluída comparável" : "tarefas concluídas comparáveis"}`,
    },
    {
      key: "percentualTarefasSemHoras",
      label: "Concluídas sem horas",
      value: summary?.percentualTarefasSemHoras,
      hint: `${summary?.tarefasSemHoras ?? 0} de ${summary?.tarefasConcluidas ?? 0} ${summary?.tarefasConcluidas === 1 ? "concluída" : "concluídas"}`,
    },
    {
      key: "percentualTarefasSemEstimativa",
      label: "Tarefas sem estimativa",
      value: summary?.percentualTarefasSemEstimativa,
      hint: `${summary?.tarefasSemEstimativa ?? 0} de ${summary?.tarefas ?? 0} ${summary?.tarefas === 1 ? "tarefa" : "tarefas"}`,
    },
  ];
  return (
    <div className="operational-metrics" aria-busy={loading}>
      {cards.map((card) => (
        <article className="summary-card" key={card.key}>
          <div>
            <span>{card.label}</span>
            <strong>{loading ? "…" : percent(card.value)}</strong>
            <small>{card.hint}</small>
            {!loading && summary && card.value == null && (
              <small>
                {
                  summary.motivos?.[
                    context && card.key === "assertividadeEstimativas"
                      ? "assertividadeTarefasContexto"
                      : card.key
                  ]
                }
              </small>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

// [TELA] Ocorrências da auditoria com filtro por tipo e link para corrigir.
export function AuditTable({ occurrences = [] }) {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const types = useMemo(() => [...new Set(occurrences.map((row) => row.tipo))], [occurrences]);
  const visible = occurrences.filter(
    (row) =>
      (!type || row.tipo === type) &&
      (!search ||
        [row.projeto, row.tarefa, row.colaborador, row.descricao]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"))),
  );
  const paginacao = usePaginacao(visible);
  return (
    <div className="operational-audit">
      <div className="table-toolbar">
        <label className="search-field">
          <input
            aria-label="Buscar ocorrência"
            placeholder="Buscar ocorrência"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          aria-label="Tipo de ocorrência"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">Todos os tipos</option>
          {types.map((key) => (
            <option value={key} key={key}>
              {issueLabels[key]}
            </option>
          ))}
        </select>
      </div>
      <div className="dashboard-table">
        <table>
          <caption>
            {visible.length} {visible.length === 1 ? "ocorrência" : "ocorrências"} · uma tarefa ou
            apontamento pode ter mais de uma pendência.
          </caption>
          <thead>
            <tr>
              <th>Ocorrência</th>
              <th>Projeto</th>
              <th>Registro</th>
              <th>Data</th>
              <th>Conferir</th>
            </tr>
          </thead>
          <tbody>
            {!visible.length ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  Nenhuma ocorrência neste recorte.
                </td>
              </tr>
            ) : (
              paginacao.itensPaginados.map((row) => (
                <tr key={row.chave}>
                  <td title={row.descricao ? `${issueLabels[row.tipo]} — ${row.descricao}` : issueLabels[row.tipo]}>
                    {issueLabels[row.tipo]}
                    <small className="dashboard-detail-note" title={row.descricao}>
                      {row.descricao}
                    </small>
                  </td>
                  <td title={row.projeto}>
                    <Link to={`/dashboard/projetos/${row.projetoId}`}>{row.projeto}</Link>
                  </td>
                  <td title={row.tarefa || row.colaborador || "Apontamento"}>
                    {row.tarefa || row.colaborador || "Apontamento"}
                  </td>
                  <td>{date(row.data)}</td>
                  <td>
                    <Link
                      to={
                        TIPOS_PENDENCIA_CUSTO.includes(row.tipo)
                          ? linkDaPendencia(row)
                          : row.tarefaId
                            ? taskUrl(row)
                            : `/apontamentos?editar=${row.apontamentoId}`
                      }
                    >
                      {row.tipo === "SEM_REMUNERACAO"
                        ? "Financeiro"
                        : row.tipo === "SEM_VINCULO"
                          ? "Equipe e datas"
                          : row.tarefaId
                            ? "Conferir tarefa"
                            : "Conferir horas"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginacaoTabela
        pagina={paginacao.pagina}
        totalPaginas={paginacao.totalPaginas}
        totalItens={paginacao.totalItens}
        inicio={paginacao.inicio}
        fim={paginacao.fim}
        onPageChange={paginacao.setPagina}
        rotulo="Páginas de ocorrências da auditoria"
      />
    </div>
  );
}

// [TELA] Tarefas que entram nos indicadores (estimativa, horas, correção).
export function IndicatorTasksTable({ tasks = [], individual = false }) {
  const paginacao = usePaginacao(tasks);
  return (
    <div className="dashboard-table">
      <table>
        <caption>
          {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"} no recorte · canceladas não
          entram nas contagens de tarefas; horas efetivamente registradas são preservadas.
        </caption>
        <thead>
          <tr>
            <th>Tarefa</th>
            <th>Projeto / sprint</th>
            <th>Responsáveis</th>
            <th>Status</th>
            <th>Estimativa da tarefa</th>
            <th>{individual ? "Horas da pessoa no recorte" : "Horas no recorte"}</th>
            <th>Horas totais da tarefa</th>
            <th>Estimativa comparável</th>
          </tr>
        </thead>
        <tbody>
          {!tasks.length ? (
            <tr>
              <td className="empty-cell" colSpan={8}>
                Nenhuma tarefa neste recorte.
              </td>
            </tr>
          ) : (
            paginacao.itensPaginados.map((task) => {
              const textoResponsaveis =
                task.responsaveis.map((person) => person.nome).join(", ") || "Sem responsáveis";
              return (
                <tr key={task.id}>
                  <td title={task.titulo}>
                    <Link to={taskUrl(task)}>{task.titulo}</Link>
                    {task.correcao && <small className="dashboard-detail-note">Correção</small>}
                    {task.statusRegistro === "INATIVO" && (
                      <small className="dashboard-detail-note">Arquivada</small>
                    )}
                  </td>
                  <td title={`${task.projeto} — ${task.sprint || "Sem sprint"}`}>
                    {task.projeto}
                    <small className="dashboard-detail-note">{task.sprint || "Sem sprint"}</small>
                  </td>
                  <td title={textoResponsaveis}>{textoResponsaveis}</td>
                  <td>{taskStatus[task.status]}</td>
                  <td>
                    {task.minutosEstimados == null
                      ? "Sem estimativa"
                      : `${Math.floor(task.minutosEstimados / 60)}h ${task.minutosEstimados % 60}min`}
                  </td>
                  <td>{number(task.horasNoRecorte)} h</td>
                  <td>{number(task.horasTotais)} h</td>
                  <td>
                    {task.comparavel ? "Sim" : "Não"}
                    {task.semHoras && (
                      <small className="dashboard-detail-note">Concluída sem horas</small>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <PaginacaoTabela
        pagina={paginacao.pagina}
        totalPaginas={paginacao.totalPaginas}
        totalItens={paginacao.totalItens}
        inicio={paginacao.inicio}
        fim={paginacao.fim}
        onPageChange={paginacao.setPagina}
        rotulo="Páginas de tarefas dos indicadores"
      />
    </div>
  );
}
