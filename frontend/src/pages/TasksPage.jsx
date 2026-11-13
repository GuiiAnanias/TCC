import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Check, Edit3, RotateCcw, Save, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { HelpDialog } from "../components/HelpDialog.jsx";
import { PageActions } from "../components/PageActions.jsx";
import { projectStatusLabel } from "../config/projectOptions.js";

const statuses = {
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};
const emptyTask = () => ({
  titulo: "",
  descricao: "",
  sprintId: "",
  status: "PLANEJADA",
  horasEstimadas: "",
  minutosExtras: "",
  correcao: false,
  dataInicio: "",
  dataConclusao: "",
  responsavelIds: [],
});
const emptySprint = () => ({ nome: "", dataInicio: "", dataFim: "" });
const day = (value) => (value ? String(value).slice(0, 10) : "");
const date = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const duration = (value) =>
  value == null ? "Sem estimativa" : `${Math.floor(value / 60)}h ${value % 60}min`;
const failure = (error) =>
  error.response?.data?.errors?.[0]?.message ||
  error.response?.data?.message ||
  "Não foi possível concluir a operação.";

export function TasksPage() {
  const [query] = useSearchParams();
  const handledTask = useRef("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(() => query.get("projetoId") || "");
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [team, setTeam] = useState([]);
  const [tab, setTab] = useState("tarefas");
  const [form, setForm] = useState(emptyTask);
  const [sprintForm, setSprintForm] = useState(emptySprint);
  const [editing, setEditing] = useState(null);
  const [editingSprint, setEditingSprint] = useState(null);
  const [filters, setFilters] = useState({
    busca: "",
    status: "",
    sprintId: "",
    registro: "ATIVO",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const formRegion = useRef(null);
  const selectedProject = projects.find((project) => String(project.id) === projectId);
  const readOnly = !selectedProject || selectedProject.status !== "ATIVO";

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/projetos", { signal: controller.signal })
      .then(({ data }) => setProjects(data))
      .catch((err) => {
        if (!controller.signal.aborted) setError(failure(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const load = useCallback(async () => {
    const sequence = ++request.current;
    if (!projectId) {
      setTasks([]);
      setSprints([]);
      setTeam([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [taskResponse, sprintResponse, teamResponse] = await Promise.all([
        api.get("/tarefas", { params: { projetoId: projectId } }),
        api.get("/sprints", { params: { projetoId: projectId } }),
        api.get(`/projetos/${projectId}/equipe`),
      ]);
      if (sequence !== request.current) return;
      setTasks(taskResponse.data);
      setSprints(sprintResponse.data);
      setTeam(teamResponse.data);
    } catch (err) {
      if (sequence === request.current) setError(failure(err));
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
    return () => {
      request.current++;
    };
  }, [load]);

  const people = useMemo(() => {
    const options = new Map();
    for (const member of team)
      if (member.colaborador?.status === "ATIVO")
        options.set(member.colaboradorId, member.colaborador);
    for (const row of editing?.responsaveis ?? []) options.set(row.colaboradorId, row.colaborador);
    return [...options.values()].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
  }, [team, editing]);
  const visibleTasks = tasks.filter(
    (task) =>
      (!filters.busca ||
        task.titulo
          .toLocaleLowerCase("pt-BR")
          .includes(filters.busca.toLocaleLowerCase("pt-BR"))) &&
      (!filters.status || task.status === filters.status) &&
      (!filters.sprintId || String(task.sprintId) === filters.sprintId) &&
      (!filters.registro || task.statusRegistro === filters.registro),
  );
  const visibleSprints = sprints.filter(
    (sprint) =>
      (!filters.busca ||
        sprint.nome
          .toLocaleLowerCase("pt-BR")
          .includes(filters.busca.toLocaleLowerCase("pt-BR"))) &&
      (!filters.registro || sprint.statusRegistro === filters.registro),
  );

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.get("/projetos");
      setProjects(data);
      await load();
    } catch (err) {
      setError(failure(err));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm(emptyTask());
    setSprintForm(emptySprint());
    setEditing(null);
    setEditingSprint(null);
  }
  function changeProject(value) {
    request.current++;
    setProjectId(value);
    reset();
    setTasks([]);
    setSprints([]);
    setTeam([]);
    setMessage("");
    setError("");
    setFilters({ busca: "", status: "", sprintId: "", registro: "ATIVO" });
  }
  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "status" && value !== "CONCLUIDA" ? { dataConclusao: "" } : {}),
    }));
  }
  function editTask(task) {
    setEditing(task);
    setMessage("");
    setError("");
    setForm({
      titulo: task.titulo,
      descricao: task.descricao ?? "",
      sprintId: task.sprintId ?? "",
      status: task.status,
      horasEstimadas: task.minutosEstimados == null ? "" : Math.floor(task.minutosEstimados / 60),
      minutosExtras: task.minutosEstimados == null ? "" : task.minutosEstimados % 60,
      correcao: task.correcao,
      dataInicio: day(task.dataInicio),
      dataConclusao: day(task.dataConclusao),
      responsavelIds: task.responsaveis.map((row) => row.colaboradorId),
    });
    formRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function editSprint(sprint) {
    setEditingSprint(sprint);
    setSprintForm({
      nome: sprint.nome,
      dataInicio: day(sprint.dataInicio),
      dataFim: day(sprint.dataFim),
    });
    setMessage("");
    setError("");
    formRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event) {
    event.preventDefault();
    if (readOnly || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (tab === "tarefas") {
        const estimated =
          form.horasEstimadas === "" && form.minutosExtras === ""
            ? null
            : Number(form.horasEstimadas || 0) * 60 + Number(form.minutosExtras || 0);
        const payload = {
          projetoId: Number(projectId),
          titulo: form.titulo,
          descricao: form.descricao || null,
          sprintId: form.sprintId ? Number(form.sprintId) : null,
          status: form.status,
          minutosEstimados: estimated,
          correcao: form.correcao,
          dataInicio: form.dataInicio || null,
          dataConclusao: form.dataConclusao || null,
          responsavelIds: form.responsavelIds,
        };
        if (editing) await api.put(`/tarefas/${editing.id}`, payload);
        else await api.post("/tarefas", payload);
      } else {
        const payload = {
          projetoId: Number(projectId),
          nome: sprintForm.nome,
          dataInicio: sprintForm.dataInicio || null,
          dataFim: sprintForm.dataFim || null,
        };
        if (editingSprint) await api.put(`/sprints/${editingSprint.id}`, payload);
        else await api.post("/sprints", payload);
      }
      reset();
      setMessage(tab === "tarefas" ? "Tarefa salva com sucesso." : "Sprint salva com sucesso.");
      await load();
    } catch (err) {
      setError(failure(err));
    } finally {
      setSaving(false);
    }
  }
  async function archive(row) {
    const restoring = row.statusRegistro === "INATIVO";
    const label = tab === "tarefas" ? row.titulo : row.nome;
    if (
      !window.confirm(
        `${restoring ? "Restaurar" : "Arquivar"} “${label}”? Os vínculos e apontamentos serão preservados.`,
      )
    )
      return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.put(`/${tab}/${row.id}`, { statusRegistro: restoring ? "ATIVO" : "INATIVO" });
      reset();
      setMessage(restoring ? "Registro restaurado." : "Registro arquivado. Histórico preservado.");
      await load();
    } catch (err) {
      setError(failure(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const project = query.get("projetoId");
    if (project && project !== projectId) changeProject(project);
    handledTask.current = "";
  }, [query]);

  useEffect(() => {
    const target = query.get("tarefaId");
    const key = `${projectId}:${target}`;
    if (!target || !selectedProject || loading || handledTask.current === key) return;
    const task = tasks.find((row) => String(row.id) === target);
    if (!task) return;
    handledTask.current = key;
    setFilters({ busca: "", status: "", sprintId: "", registro: "" });
    setTab("tarefas");
    editTask(task);
  }, [query, projectId, tasks, loading, selectedProject]);

  return (
    <section className="content-panel tasks-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Planejamento e execução</span>
          <div className="dashboard-title-row">
            <h1>Tarefas e sprints</h1>
            <HelpDialog title="Ajuda — Tarefas e sprints">
              <section>
                <h3>Projeto e sprints</h3>
                <p>
                  Selecione o projeto para cadastrar e consultar tarefas e sprints. A sprint é
                  opcional e deve pertencer ao mesmo projeto. Datas são opcionais: não são
                  preenchidas automaticamente. Os períodos das sprints servem ao planejamento e não
                  impedem apontamentos fora dessas datas.
                </p>
              </section>
              <section>
                <h3>Estimativa e execução</h3>
                <p>
                  Informe a estimativa em horas inteiras e minutos. Por exemplo, 2 horas e 7 minutos
                  equivalem a 127 minutos. Deixe os dois campos vazios quando não houver estimativa;
                  zero não é uma estimativa válida.
                </p>
                <p>
                  Planejada, Em andamento, Concluída e Cancelada descrevem o trabalho da tarefa. São
                  independentes de Pendente, Aprovado e Faturado dos apontamentos. A data de
                  conclusão é opcional, só aceita para tarefas concluídas e é removida do formulário
                  ao reabrir a tarefa.
                </p>
                <p>
                  Marque Correção quando o trabalho for destinado a corrigir problemas. Essa
                  identificação prepara os indicadores da próxima etapa.
                </p>
              </section>
              <section>
                <h3>Responsáveis e horas</h3>
                <p>
                  Uma tarefa pode ter nenhum, um ou vários responsáveis. Para adicionar alguém,
                  vincule o colaborador ativo à equipe do projeto. Responsabilidades existentes
                  continuam consultáveis mesmo após a inativação da pessoa.
                </p>
                <p>
                  As horas são lançadas em Apontamento de Horas, selecionando uma tarefa do mesmo
                  projeto. O total soma cada apontamento uma vez, independentemente do número de
                  responsáveis. Cada apontamento mantém seu próprio colaborador; responsáveis não
                  recebem cópias das horas.
                </p>
                <p>
                  Apontamentos antigos continuam sem tarefa até que você os vincule pela edição. Não
                  há duplicação nem atribuição automática.
                </p>
              </section>
              <section>
                <h3>Histórico</h3>
                <p>
                  Arquivar mantém tarefas, sprints e horas para consulta. Tarefas arquivadas não
                  recebem novos vínculos de horas. Arquivar uma sprint mantém suas tarefas
                  existentes; para novas tarefas, selecione uma sprint ativa. Projetos não ativos
                  ficam disponíveis para consulta.
                </p>
              </section>
            </HelpDialog>
          </div>
        </div>
        <PageActions onRefresh={refresh} loading={loading || saving} />
      </header>
      <div className="feedback-row">
        {error && (
          <div className="feedback error" role="alert">
            <X size={18} />
            {error}
          </div>
        )}
        {message && (
          <div className="feedback success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
        {selectedProject && selectedProject.status !== "ATIVO" && (
          <div className="feedback warning">
            Projeto {projectStatusLabel(selectedProject.status).toLowerCase()}: disponível apenas
            para consulta. Reative em Projetos para fazer alterações.
          </div>
        )}
      </div>
      <div className="form-panel">
        <label className="field">
          <span>Projeto</span>
          <select
            value={projectId}
            onChange={(event) => changeProject(event.target.value)}
            disabled={saving}
          >
            <option value="">Selecione um projeto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.nome}
                {project.status !== "ATIVO"
                  ? ` (${projectStatusLabel(project.status).toLowerCase()})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tasks-tabs" role="group" aria-label="Tipo de cadastro">
        {[
          ["tarefas", "Tarefas"],
          ["sprints", "Sprints"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "primary-button" : "secondary-button"}
            type="button"
            key={key}
            aria-pressed={tab === key}
            disabled={saving}
            onClick={() => {
              setTab(key);
              setMessage("");
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {!projectId ? (
        <p className="empty-cell">Selecione um projeto para começar.</p>
      ) : (
        <>
          {!readOnly && (
            <form ref={formRegion} className="form-panel" onSubmit={submit}>
              <h2>
                {tab === "tarefas"
                  ? editing
                    ? "Editar tarefa"
                    : "Nova tarefa"
                  : editingSprint
                    ? "Editar sprint"
                    : "Nova sprint"}
              </h2>
              <fieldset className="tasks-form-fields" disabled={saving || loading}>
                <div className="form-grid">
                  {tab === "tarefas" ? (
                    <>
                      <label className="field">
                        <span>Título da tarefa</span>
                        <input
                          name="titulo"
                          required
                          minLength={3}
                          maxLength={200}
                          value={form.titulo}
                          onChange={update}
                        />
                      </label>
                      <label className="field">
                        <span>Sprint (opcional)</span>
                        <select name="sprintId" value={form.sprintId} onChange={update}>
                          <option value="">Sem sprint</option>
                          {sprints
                            .filter(
                              (sprint) =>
                                sprint.statusRegistro === "ATIVO" ||
                                sprint.id === editing?.sprintId,
                            )
                            .map((sprint) => (
                              <option key={sprint.id} value={sprint.id}>
                                {sprint.nome}
                                {sprint.statusRegistro === "INATIVO" ? " (arquivada)" : ""}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Status da tarefa</span>
                        <select name="status" value={form.status} onChange={update}>
                          {Object.entries(statuses).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="field">
                        <span>Estimativa (opcional)</span>
                        <div className="tasks-estimate">
                          <label className="field">
                            <span>Horas inteiras</span>
                            <input
                              aria-label="Horas estimadas"
                              type="number"
                              name="horasEstimadas"
                              min="0"
                              max="100000"
                              step="1"
                              value={form.horasEstimadas}
                              onChange={update}
                              placeholder="Horas"
                            />
                          </label>
                          <label className="field">
                            <span>Minutos</span>
                            <input
                              aria-label="Minutos estimados"
                              type="number"
                              name="minutosExtras"
                              min="0"
                              max="59"
                              step="1"
                              value={form.minutosExtras}
                              onChange={update}
                              placeholder="Minutos"
                            />
                          </label>
                        </div>
                      </div>
                      <label className="field">
                        <span>Início (opcional)</span>
                        <input
                          name="dataInicio"
                          type="date"
                          value={form.dataInicio}
                          onChange={update}
                        />
                      </label>
                      <label className="field">
                        <span>Conclusão (opcional)</span>
                        <input
                          name="dataConclusao"
                          type="date"
                          disabled={saving || loading || form.status !== "CONCLUIDA"}
                          min={form.dataInicio || undefined}
                          value={form.dataConclusao}
                          onChange={update}
                        />
                      </label>
                      <label className="field">
                        <span>Descrição (opcional)</span>
                        <textarea
                          name="descricao"
                          maxLength={3000}
                          value={form.descricao}
                          onChange={update}
                          rows={3}
                        />
                      </label>
                      <label className="tasks-check">
                        <input
                          name="correcao"
                          type="checkbox"
                          checked={form.correcao}
                          onChange={update}
                        />
                        <span>Tarefa de correção</span>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="field">
                        <span>Nome da sprint</span>
                        <input
                          required
                          minLength={3}
                          maxLength={150}
                          value={sprintForm.nome}
                          onChange={(event) =>
                            setSprintForm((current) => ({ ...current, nome: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Início (opcional)</span>
                        <input
                          type="date"
                          value={sprintForm.dataInicio}
                          onChange={(event) =>
                            setSprintForm((current) => ({
                              ...current,
                              dataInicio: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Fim (opcional)</span>
                        <input
                          type="date"
                          min={sprintForm.dataInicio || undefined}
                          value={sprintForm.dataFim}
                          onChange={(event) =>
                            setSprintForm((current) => ({
                              ...current,
                              dataFim: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
                {tab === "tarefas" && (
                  <fieldset className="tasks-responsibles">
                    <legend>Responsáveis (opcional)</legend>
                    {!people.length ? (
                      <p>Nenhum colaborador ativo na equipe do projeto.</p>
                    ) : (
                      people.map((person) => (
                        <label className="tasks-check" key={person.id}>
                          <input
                            type="checkbox"
                            checked={form.responsavelIds.includes(person.id)}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                responsavelIds: event.target.checked
                                  ? [...current.responsavelIds, person.id]
                                  : current.responsavelIds.filter((id) => id !== person.id),
                              }))
                            }
                          />
                          <span>
                            {person.nomeCompleto}
                            {person.status === "INATIVO" ? " (inativo)" : ""}
                          </span>
                        </label>
                      ))
                    )}
                  </fieldset>
                )}
                <div className="actions-row">
                  <button type="submit" className="primary-button">
                    <Save size={18} />
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                  <button type="button" className="secondary-button" onClick={reset}>
                    <RotateCcw size={18} />
                    {editing || editingSprint ? "Cancelar edição" : "Limpar"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          <div className="table-panel">
            <div className="table-toolbar tasks-filters">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Buscar tarefas ou sprints"
                  placeholder="Buscar"
                  value={filters.busca}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, busca: event.target.value }))
                  }
                />
              </label>
              {tab === "tarefas" && (
                <>
                  <select
                    aria-label="Filtrar status da tarefa"
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="">Todos os status</option>
                    {Object.entries(statuses).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar sprint"
                    value={filters.sprintId}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, sprintId: event.target.value }))
                    }
                  >
                    <option value="">Todas as sprints</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.nome}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <select
                aria-label="Filtrar arquivamento"
                value={filters.registro}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, registro: event.target.value }))
                }
              >
                <option value="ATIVO">Ativas</option>
                <option value="INATIVO">Arquivadas</option>
                <option value="">Todas</option>
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {(tab === "tarefas"
                      ? [
                          "Tarefa",
                          "Sprint",
                          "Responsáveis",
                          "Status",
                          "Estimativa",
                          "Horas registradas",
                          "Início",
                          "Conclusão",
                          "Ações",
                        ]
                      : ["Sprint", "Início", "Fim", "Tarefas", "Cadastro", "Ações"]
                    ).map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="empty-cell" colSpan={tab === "tarefas" ? 9 : 6}>
                        Carregando…
                      </td>
                    </tr>
                  ) : tab === "tarefas" ? (
                    visibleTasks.length ? (
                      visibleTasks.map((task) => (
                        <tr key={task.id}>
                          <td>
                            <strong>{task.titulo}</strong>
                            {task.correcao && <span className="tasks-detail">Correção</span>}
                            {task.statusRegistro === "INATIVO" && (
                              <span className="tasks-detail">Arquivada</span>
                            )}
                            {task.descricao && (
                              <span className="tasks-detail">{task.descricao}</span>
                            )}
                          </td>
                          <td>{task.sprint?.nome ?? "Sem sprint"}</td>
                          <td>
                            {task.responsaveis
                              .map((row) => row.colaborador.nomeCompleto)
                              .join(", ") || "Sem responsáveis"}
                          </td>
                          <td>{statuses[task.status]}</td>
                          <td>{duration(task.minutosEstimados)}</td>
                          <td>
                            {Number(task.horasRealizadas).toLocaleString("pt-BR", {
                              maximumFractionDigits: 2,
                            })}
                            h
                          </td>
                          <td>{date(task.dataInicio)}</td>
                          <td>{date(task.dataConclusao)}</td>
                          <td>
                            {!readOnly && (
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="icon-button"
                                  title="Editar tarefa"
                                  aria-label={`Editar ${task.titulo}`}
                                  disabled={saving}
                                  onClick={() => editTask(task)}
                                >
                                  <Edit3 size={17} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  title={
                                    task.statusRegistro === "ATIVO"
                                      ? "Arquivar tarefa"
                                      : "Restaurar tarefa"
                                  }
                                  aria-label={`${task.statusRegistro === "ATIVO" ? "Arquivar" : "Restaurar"} ${task.titulo}`}
                                  disabled={saving}
                                  onClick={() => archive(task)}
                                >
                                  {task.statusRegistro === "ATIVO" ? (
                                    <Archive size={17} />
                                  ) : (
                                    <RotateCcw size={17} />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="empty-cell">
                          Nenhuma tarefa encontrada.
                        </td>
                      </tr>
                    )
                  ) : visibleSprints.length ? (
                    visibleSprints.map((sprint) => (
                      <tr key={sprint.id}>
                        <td>{sprint.nome}</td>
                        <td>{date(sprint.dataInicio)}</td>
                        <td>{date(sprint.dataFim)}</td>
                        <td>{sprint._count.tarefas}</td>
                        <td>{sprint.statusRegistro === "ATIVO" ? "Ativa" : "Arquivada"}</td>
                        <td>
                          {!readOnly && (
                            <div className="row-actions">
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`Editar ${sprint.nome}`}
                                title="Editar sprint"
                                disabled={saving}
                                onClick={() => editSprint(sprint)}
                              >
                                <Edit3 size={17} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`${sprint.statusRegistro === "ATIVO" ? "Arquivar" : "Restaurar"} ${sprint.nome}`}
                                title={
                                  sprint.statusRegistro === "ATIVO"
                                    ? "Arquivar sprint"
                                    : "Restaurar sprint"
                                }
                                disabled={saving}
                                onClick={() => archive(sprint)}
                              >
                                {sprint.statusRegistro === "ATIVO" ? (
                                  <Archive size={17} />
                                ) : (
                                  <RotateCcw size={17} />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        Nenhuma sprint encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
