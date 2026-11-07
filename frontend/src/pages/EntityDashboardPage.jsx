import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Filter, RotateCcw } from "lucide-react";
import { api } from "../api/client.js";
import { FloatingActions } from "../components/FloatingActions.jsx";
import { DashboardHelp } from "../components/DashboardHelp.jsx";
import { projectStatusLabel } from "../config/projectOptions.js";
import {
  AuditTable,
  IndicatorTasksTable,
  OperationalMetrics,
  date,
  money,
  number,
  percent,
} from "../components/OperationalDashboard.jsx";

const emptyFilters = { dataInicio: "", dataFim: "", projetoId: "", sprintId: "" };
export function EntityDashboardPage({ type }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const individual = type === "colaboradores";
  const [data, setData] = useState(null);
  const [options, setOptions] = useState({ projetos: [], colaboradores: [] });
  const [optionsError, setOptionsError] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState("tarefas");
  const request = useRef(0);
  const appliedRef = useRef(emptyFilters);
  const load = useCallback(
    async (next = appliedRef.current) => {
      const sequence = ++request.current;
      setLoading(true);
      setError("");
      try {
        const params = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== ""));
        const response = await api.get(`/dashboard/${type}/${id}`, { params });
        if (sequence !== request.current) return;
        setData(response.data);
        setApplied(next);
        appliedRef.current = next;
      } catch (err) {
        if (sequence === request.current)
          setError(
            err.response?.data?.errors?.[0]?.message ||
              err.response?.data?.message ||
              "Não foi possível carregar este dashboard.",
          );
      } finally {
        if (sequence === request.current) setLoading(false);
      }
    },
    [id, type],
  );
  const loadOptions = useCallback(async () => {
    try {
      const response = await api.get("/dashboard/opcoes");
      setOptions(response.data);
      setOptionsError("");
    } catch {
      setOptionsError("Não foi possível carregar as opções de navegação. Tente atualizar.");
    }
  }, []);
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);
  useEffect(() => {
    setData(null);
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    appliedRef.current = emptyFilters;
    setSection("tarefas");
    load(emptyFilters);
    return () => {
      request.current++;
    };
  }, [load]);
  const summary = data?.resumo;
  const entity = individual ? data?.colaborador : data?.projeto;
  const changed = Object.keys(filters).some((key) => filters[key] !== applied[key]);
  const filtered = Object.values(applied).some(Boolean);
  function update(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }
  const cards = [
    ["Horas registradas", summary ? `${number(summary.horas)} h` : "—", "Apontamentos no recorte"],
    [
      "Custo total",
      summary ? money(summary.custo) : "—",
      summary?.horasSemCusto
        ? `Parcial · ${number(summary.horasSemCusto)} h sem valor/hora`
        : "Valor/hora preservado e bônus",
    ],
    ["Custo base", summary ? money(summary.custoBase) : "—", "Sem incluir benefícios mensais"],
    ["Bonificação", summary ? money(summary.bonificacao) : "—", "Conforme papel e data das horas"],
    individual
      ? ["Projetos no recorte", summary?.projetos ?? "—", "Participação, tarefas ou horas"]
      : [
          "Orçamento do projeto",
          entity ? money(entity.valorProjeto) : "—",
          "Orçamento integral do contrato",
        ],
    individual
      ? [
          "Ocorrências de auditoria",
          summary?.totalOcorrencias ?? "—",
          "Responsabilidades e apontamentos",
        ]
      : [
          "Assertividade do orçamento",
          percent(summary?.assertividade),
          filtered
            ? "Comparação integral indisponível com este recorte"
            : "Orçamento e custo integral registrados",
        ],
  ];
  return (
    <section className="content-panel dashboard-page entity-dashboard">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dashboard {individual ? "do colaborador" : "do projeto"}</span>
          <div className="dashboard-title-row">
            <h1>
              {entity
                ? individual
                  ? entity.nomeCompleto
                  : entity.nome
                : individual
                  ? "Colaborador"
                  : "Projeto"}
            </h1>
            <DashboardHelp />
          </div>
        </div>
        <FloatingActions
          onRefresh={() => {
            load();
            loadOptions();
          }}
          loading={loading}
        />
      </header>
      <nav className="entity-dashboard-links" aria-label="Navegação do dashboard">
        <Link to="/dashboard">Dashboard geral</Link>
        <Link to={individual ? "/colaboradores" : "/projetos"}>
          {individual ? "Cadastro de colaboradores" : "Cadastro de projetos"}
        </Link>
      </nav>
      <div className="dashboard-overview">
        <label className="field entity-picker">
          <span>{individual ? "Colaborador" : "Projeto"}</span>
          <select
            value={id}
            disabled={loading || Boolean(optionsError)}
            onChange={(event) => navigate(`/dashboard/${type}/${event.target.value}`)}
          >
            {!(individual ? options.colaboradores : options.projetos).some(
              (row) => String(row.id) === id,
            ) && (
              <option value={id}>
                {entity ? (individual ? entity.nomeCompleto : entity.nome) : "Selecionado"}
              </option>
            )}
            {(individual ? options.colaboradores : options.projetos).map((row) => (
              <option key={row.id} value={row.id}>
                {individual ? row.nomeCompleto : row.nome}
                {individual
                  ? row.status === "INATIVO"
                    ? " (inativo)"
                    : ""
                  : ` (${projectStatusLabel(row.status)})`}
              </option>
            ))}
          </select>
        </label>
        {entity && (
          <p className="dashboard-scope">
            {individual
              ? `${entity.cargo} · ${entity.departamento}`
              : `${entity.cliente.nome} · ${number(entity.horasContratadas)} h contratadas · Início ${date(entity.dataInicio)}`}{" "}
            ·{" "}
            {individual
              ? entity.status === "ATIVO"
                ? "Ativo"
                : "Inativo"
              : projectStatusLabel(entity.status)}
          </p>
        )}
        <form
          className="dashboard-filters entity-dashboard-filters"
          onSubmit={(event) => {
            event.preventDefault();
            load({ ...filters });
          }}
        >
          <fieldset className="dashboard-period" disabled={loading}>
            <legend>Período</legend>
            <div>
              <label className="field">
                <span>Data inicial</span>
                <input
                  type="date"
                  name="dataInicio"
                  value={filters.dataInicio}
                  max={filters.dataFim || "9999-12-31"}
                  onChange={update}
                />
              </label>
              <label className="field">
                <span>Data final</span>
                <input
                  type="date"
                  name="dataFim"
                  value={filters.dataFim}
                  min={filters.dataInicio || undefined}
                  onChange={update}
                />
              </label>
            </div>
          </fieldset>
          {individual ? (
            <label className="field">
              <span>Projeto</span>
              <select
                name="projetoId"
                value={filters.projetoId}
                disabled={loading || Boolean(optionsError)}
                onChange={update}
              >
                <option value="">Todos os projetos</option>
                {options.projetos.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Sprint</span>
              <select name="sprintId" value={filters.sprintId} onChange={update} disabled={loading}>
                <option value="">Todas as sprints</option>
                {entity?.sprints.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.nome}
                    {row.statusRegistro === "INATIVO" ? " (arquivada)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dashboard-filter-actions">
            <button className="primary-button" type="submit" disabled={loading}>
              <Filter size={16} />
              Aplicar filtros
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={loading || (!changed && !filtered)}
              onClick={() => {
                setFilters(emptyFilters);
                load(emptyFilters);
              }}
            >
              <RotateCcw size={16} />
              Limpar
            </button>
          </div>
        </form>
        <p role="status" className="dashboard-scope">
          {loading
            ? "Carregando indicadores…"
            : changed
              ? "Há filtros alterados. Clique em Aplicar filtros para atualizar."
              : filtered
                ? "Exibindo o recorte aplicado."
                : "Todos os períodos. Histórico preservado, incluindo registros arquivados."}
        </p>
        {optionsError && (
          <div className="feedback error" role="alert">
            {optionsError}
          </div>
        )}
        {error && (
          <div className="feedback error" role="alert">
            {error}
            {data && " Os últimos dados carregados foram mantidos."}
          </div>
        )}
        <div className="summary-grid dashboard-summary" aria-busy={loading}>
          {cards.map(([label, value, hint]) => (
            <article key={label} className="summary-card">
              <div>
                <span>{label}</span>
                <strong>{loading ? "…" : value}</strong>
                <small>{hint}</small>
              </div>
            </article>
          ))}
        </div>
        <h2 className="dashboard-operational-title">Indicadores operacionais</h2>
        <OperationalMetrics summary={summary} loading={loading} context={individual} />
      </div>
      {data && (
        <>
          <div className="entity-dashboard-tabs" role="group" aria-label="Detalhes do dashboard">
            {[
              ["tarefas", "Tarefas"],
              ["apontamentos", "Apontamentos"],
              ["equipe", "Participação e custos"],
              ["auditoria", `Auditoria (${summary.totalOcorrencias})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={section === key ? "primary-button" : "secondary-button"}
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <section className="dashboard-detail" aria-busy={loading}>
            {loading ? (
              <p role="status">Carregando…</p>
            ) : section === "tarefas" ? (
              <>
                <h2>Tarefas</h2>
                <IndicatorTasksTable tasks={data.tarefas} individual={individual} />
              </>
            ) : section === "auditoria" ? (
              <>
                <h2>Ocorrências de auditoria</h2>
                <AuditTable occurrences={data.ocorrencias} />
              </>
            ) : section === "apontamentos" ? (
              <>
                <h2>Apontamentos e composição do custo</h2>
                <div className="dashboard-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Projeto</th>
                        <th>Colaborador</th>
                        <th>Tarefa</th>
                        <th>Horas</th>
                        <th>Papel</th>
                        <th>Valor/hora</th>
                        <th>Bônus</th>
                        <th>Custo base</th>
                        <th>Bonificação</th>
                        <th>Custo total</th>
                        <th>Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data.apontamentos.length ? (
                        <tr>
                          <td colSpan={12} className="empty-cell">
                            Sem apontamentos no recorte.
                          </td>
                        </tr>
                      ) : (
                        data.apontamentos.map((row) => (
                          <tr key={row.id}>
                            <td>{date(row.data)}</td>
                            <td>
                              <Link to={`/dashboard/projetos/${row.projetoId}`}>{row.projeto}</Link>
                            </td>
                            <td>
                              <Link to={`/dashboard/colaboradores/${row.colaboradorId}`}>
                                {row.colaborador}
                              </Link>
                            </td>
                            <td>{row.tarefa || "Sem tarefa"}</td>
                            <td>{number(row.horas)} h</td>
                            <td>{row.papel || "Sem vínculo"}</td>
                            <td>
                              {row.valorHora == null ? "Sem remuneração" : money(row.valorHora)}
                            </td>
                            <td>{number(row.percentual)}%</td>
                            <td>{money(row.custoBase)}</td>
                            <td>{money(row.bonificacao)}</td>
                            <td>{row.semCusto ? "Indisponível" : money(row.custo)}</td>
                            <td>
                              <Link to={`/apontamentos?editar=${row.id}`}>Conferir</Link>
                              <small className="dashboard-detail-note">{row.status}</small>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <h2>Participação e custos</h2>
                {individual ? (
                  <div className="dashboard-table">
                    <table>
                      <caption>
                        Custos individuais por projeto, sem atribuir orçamento integral à pessoa.
                      </caption>
                      <thead>
                        <tr>
                          <th>Projeto</th>
                          <th>Horas próprias</th>
                          <th>Custo base</th>
                          <th>Bonificação</th>
                          <th>Custo total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!data.projetos.length ? (
                          <tr>
                            <td colSpan={5} className="empty-cell">
                              Sem projetos neste recorte.
                            </td>
                          </tr>
                        ) : (
                          data.projetos.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <Link to={`/dashboard/projetos/${row.id}`}>{row.nome}</Link>
                              </td>
                              <td>{number(row.horas)} h</td>
                              <td>{money(row.custoBase)}</td>
                              <td>{money(row.bonificacao)}</td>
                              <td>
                                {money(row.custo)}
                                {row.horasSemCusto > 0 && (
                                  <small className="dashboard-detail-note">
                                    Parcial · {number(row.horasSemCusto)} h sem custo
                                  </small>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="dashboard-table">
                    <table>
                      <caption>Custos por colaborador no recorte.</caption>
                      <thead>
                        <tr>
                          <th>Colaborador</th>
                          <th>Horas</th>
                          <th>Custo base</th>
                          <th>Bonificação</th>
                          <th>Custo total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!data.colaboradores.length ? (
                          <tr>
                            <td colSpan={5} className="empty-cell">
                              Sem horas registradas.
                            </td>
                          </tr>
                        ) : (
                          data.colaboradores.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <Link to={`/dashboard/colaboradores/${row.id}`}>{row.nome}</Link>
                              </td>
                              <td>{number(row.horas)} h</td>
                              <td>{money(row.custoBase)}</td>
                              <td>{money(row.bonificacao)}</td>
                              <td>
                                {money(row.custo)}
                                {row.horasSemCusto > 0 && (
                                  <small className="dashboard-detail-note">
                                    Parcial · {number(row.horasSemCusto)} h sem custo
                                  </small>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="dashboard-table entity-memberships">
                  <table>
                    <caption>
                      Histórico de participações no projeto e período selecionados. Participar não
                      atribui horas automaticamente.
                    </caption>
                    <thead>
                      <tr>
                        <th>Projeto</th>
                        <th>Colaborador</th>
                        <th>Cargo</th>
                        <th>Papel</th>
                        <th>Entrada</th>
                        <th>Último dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data.equipe.length ? (
                        <tr>
                          <td colSpan={6} className="empty-cell">
                            Sem participação de equipe neste recorte.
                          </td>
                        </tr>
                      ) : (
                        data.equipe.map((member) => (
                          <tr key={`${member.projetoId}:${member.id}`}>
                            <td>
                              <Link to={`/dashboard/projetos/${member.projetoId}`}>
                                {member.projeto}
                              </Link>
                            </td>
                            <td>
                              <Link to={`/dashboard/colaboradores/${member.colaboradorId}`}>
                                {member.nome}
                              </Link>
                            </td>
                            <td>{member.cargo}</td>
                            <td>{member.papel}</td>
                            <td>{date(member.dataEntrada)}</td>
                            <td>{date(member.dataSaida)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
