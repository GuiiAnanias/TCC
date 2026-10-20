import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export const number = (value) => Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export const money = (value) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const percent = (value) => value == null ? "Indisponível" : `${number(value)}%`;
export const date = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
export const taskStatus = { PLANEJADA: "Planejada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" };
const issueLabels = { SEM_REMUNERACAO: "Sem remuneração", SEM_VINCULO: "Sem participação na equipe", SEM_TAREFA: "Horas sem tarefa", SEM_ESTIMATIVA: "Tarefa sem estimativa", CONCLUIDA_SEM_HORAS: "Concluída sem horas" };
export function taskUrl(row) { return `/tarefas?projetoId=${row.projetoId}&tarefaId=${row.tarefaId ?? row.id}`; }

export function OperationalMetrics({ summary, loading = false, context = false }) {
  const cards = [
    { key: "percentualCorrecoes", label: "Correções (horas)", value: summary?.percentualCorrecoes, hint: `${number(summary?.horasCorrecao)} h de ${number(summary?.horas)} h${summary?.correcoesParciais ? " · parcial" : ""}` },
    { key: "assertividadeEstimativas", label: context ? "Assertividade das tarefas (contexto)" : "Assertividade das estimativas", value: context ? summary?.assertividadeTarefasContexto : summary?.assertividadeEstimativas, hint: `${summary?.tarefasComparaveis ?? 0} ${summary?.tarefasComparaveis === 1 ? "tarefa concluída comparável" : "tarefas concluídas comparáveis"}` },
    { key: "percentualTarefasSemHoras", label: "Concluídas sem horas", value: summary?.percentualTarefasSemHoras, hint: `${summary?.tarefasSemHoras ?? 0} de ${summary?.tarefasConcluidas ?? 0} ${summary?.tarefasConcluidas === 1 ? "concluída" : "concluídas"}` },
    { key: "percentualTarefasSemEstimativa", label: "Tarefas sem estimativa", value: summary?.percentualTarefasSemEstimativa, hint: `${summary?.tarefasSemEstimativa ?? 0} de ${summary?.tarefas ?? 0} ${summary?.tarefas === 1 ? "tarefa" : "tarefas"}` }
  ];
  return <div className="operational-metrics" aria-busy={loading}>{cards.map((card) => <article className="summary-card" key={card.key}><div><span>{card.label}</span><strong>{loading ? "…" : percent(card.value)}</strong><small>{card.hint}</small>{!loading && summary && card.value == null && <small>{summary.motivos?.[context && card.key === "assertividadeEstimativas" ? "assertividadeTarefasContexto" : card.key]}</small>}</div></article>)}</div>;
}

export function AuditTable({ occurrences = [] }) {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const types = useMemo(() => [...new Set(occurrences.map((row) => row.tipo))], [occurrences]);
  const visible = occurrences.filter((row) => (!type || row.tipo === type) && (!search || [row.projeto, row.tarefa, row.colaborador, row.descricao].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))));
  return <div className="operational-audit">
    <div className="table-toolbar"><label className="search-field"><input aria-label="Buscar ocorrência" placeholder="Buscar ocorrência" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Tipo de ocorrência" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos os tipos</option>{types.map((key) => <option value={key} key={key}>{issueLabels[key]}</option>)}</select></div>
    <div className="dashboard-table"><table><caption>{visible.length} {visible.length === 1 ? "ocorrência" : "ocorrências"} · uma tarefa ou apontamento pode ter mais de uma pendência.</caption><thead><tr><th>Ocorrência</th><th>Projeto</th><th>Registro</th><th>Data</th><th>Conferir</th></tr></thead>
      <tbody>{!visible.length ? <tr><td colSpan={5} className="empty-cell">Nenhuma ocorrência neste recorte.</td></tr> : visible.map((row) => <tr key={row.chave}>
        <td>{issueLabels[row.tipo]}<small className="dashboard-detail-note">{row.descricao}</small></td>
        <td>{row.projeto}</td><td>{row.tarefa || row.colaborador || "Apontamento"}</td><td>{date(row.data)}</td>
        <td><Link to={row.tipo === "SEM_REMUNERACAO" ? "/colaboradores" : row.tipo === "SEM_VINCULO" ? "/projetos" : row.tarefaId ? taskUrl(row) : "/apontamentos"}>{row.tipo === "SEM_REMUNERACAO" ? "Financeiro" : row.tipo === "SEM_VINCULO" ? "Equipe e datas" : row.tarefaId ? "Conferir tarefa" : "Conferir horas"}</Link></td>
      </tr>)}</tbody></table></div>
  </div>;
}

