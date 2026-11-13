/**
 * [TELA] Dashboard Geral (/dashboard): filtros, indicadores, aviso de custo incompleto, gráficos e
 * as seções de detalhe (comparativo, auditoria, ranking, resumo por cliente e por equipe). Dados de
 * GET /api/dashboard.
 */

import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Filter,
  ListOrdered,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "../api/client.js";
import { PageActions } from "../components/PageActions.jsx";
import { AuditTable, OperationalMetrics } from "../components/OperationalDashboard.jsx";
import { DashboardHelp } from "../components/DashboardHelp.jsx";
import { Link } from "react-router-dom";
import { mensagemDeErro, salvarArquivo } from "../utils/download.js";
import { projectStatusOptions, projectStatusLabel } from "../config/projectOptions.js";
import { MultiSelect } from "../components/MultiSelect.jsx";
import { PendenciasCusto } from "../components/PendenciasCusto.jsx";
import {
  ajustarRecorte,
  etiquetasDoRecorte,
  mesmoRecorte,
  parametrosDoRecorte,
  PERIODOS_RAPIDOS,
  periodoRapido,
  projetosDisponiveis,
  sprintsDisponiveis,
} from "../utils/dashboardFilters.js";

// Gráficos carregados só quando aparecem, para a tela abrir mais rápido.
const DashboardProjectChart = lazy(() => import("../components/DashboardProjectChart.jsx"));
const DashboardCharts = lazy(() => import("../components/DashboardCharts.jsx"));

const emptyFilters = {
  dataInicio: "",
  dataFim: "",
  clienteId: "",
  projetoIds: [],
  colaboradorId: "",
  sprintId: "",
  equipe: "",
  statusProjeto: "ATIVO",
};
const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const percent = (value) => (value == null ? "Indisponível" : `${number(value)}%`);
const sections = [
  { key: "projetos", label: "Comparativo por projeto", icon: BarChart3 },
  { key: "auditoria", label: "Auditoria operacional", icon: ShieldCheck },
  { key: "inconsistencias", label: "Ranking de inconsistências", icon: ListOrdered },
  { key: "clientes", label: "Resumo por cliente", icon: Building2 },
  { key: "equipes", label: "Resumo por equipe", icon: Users },
];
// Colunas do ranking: os mesmos tipos e nomes da tabela de ocorrências.
const issueColumns = [
  ["SEM_REMUNERACAO", "Sem remuneração"],
  ["SEM_VINCULO", "Sem participação na equipe"],
  ["SEM_TAREFA", "Horas sem tarefa"],
  ["SEM_ESTIMATIVA", "Tarefa sem estimativa"],
  ["CONCLUIDA_SEM_HORAS", "Concluída sem horas"],
];

function Cost({ row }) {
  return (
    <>
      {money(row.custo)}
      {row.horasSemCusto > 0 && (
        <small className="dashboard-cell-note">
          Parcial · {number(row.horasSemCusto)} h sem valor/hora
        </small>
      )}
    </>
  );
}

function Bonus({ row }) {
  return <>{money(row.bonificacao)}</>;
}

// [TELA] Componente da tela.
export function DashboardPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [data, setData] = useState(null);
  const [options, setOptions] = useState({
    clientes: [],
    equipes: [],
    projetos: [],
    colaboradores: [],
    sprints: [],
  });
  const [optionsError, setOptionsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const requestId = useRef(0);
  const appliedRef = useRef(emptyFilters);

  // [REQUISICAO] GET /dashboard com os filtros aplicados; ignora respostas atrasadas de filtros
  // antigos.
  const loadSummary = useCallback(async (nextFilters = appliedRef.current) => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/dashboard", { params: parametrosDoRecorte(nextFilters) });
      if (id !== requestId.current) return;
      setData(response.data);
      setApplied(nextFilters);
      appliedRef.current = nextFilters;
    } catch (err) {
      if (id !== requestId.current) return;
      setError(
        err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          "Não foi possível carregar o dashboard. Tente atualizar novamente.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // [REQUISICAO] GET /dashboard/opcoes: listas dos filtros.
  const loadOptions = useCallback(async () => {
    try {
      const response = await api.get("/dashboard/opcoes");
      setOptions(response.data);
      setOptionsError("");
    } catch {
      setOptionsError(
        "Não foi possível carregar as opções de cliente, projeto, colaborador e equipe. Atualize para tentar novamente.",
      );
    }
  }, []);

  useEffect(() => {
    loadSummary(emptyFilters);
    loadOptions();
    return () => {
      requestId.current++;
    };
  }, [loadSummary, loadOptions]);

  // Exporta exatamente o recorte aplicado na tela, com uma linha por apontamento.
  // [REQUISICAO] Baixa o Excel com o mesmo recorte da tela (GET /relatorios/indicadores.xlsx).
  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const response = await api.get("/relatorios/indicadores.xlsx", {
        params: parametrosDoRecorte(applied),
        responseType: "blob",
      });
      salvarArquivo(response, "indicadores-codebi.xlsx");
    } catch (err) {
      setError(await mensagemDeErro(err, "Não foi possível gerar a planilha. Tente novamente."));
    } finally {
      setExporting(false);
    }
  }

  // [ESTADO] Atalho de período: aplica na hora, junto com o que já estiver escolhido nos filtros.
  function applyPeriod(datas) {
    const next = { ...filters, ...datas };
    setFilters(next);
    loadSummary(next);
  }

  // [ESTADO] Atualiza um filtro (só vale depois de Aplicar filtros).
  function updateFilter(event) {
    const { name, value } = event.target;
    // Cliente, estado e projetos se combinam: o que deixa de valer sai do recorte.
    setFilters((current) => ajustarRecorte({ ...current, [name]: value }, options));
  }

  const summary = data?.resumo;
  const filtered = !mesmoRecorte(applied, emptyFilters);
  const changed = !mesmoRecorte(filters, applied);
  const projectOptions = projetosDisponiveis(options.projetos, filters).map((project) => ({
    value: String(project.id),
    label:
      project.status === "ATIVO"
        ? project.nome
        : `${project.nome} · ${projectStatusLabel(project.status).toLocaleLowerCase("pt-BR")}`,
  }));
  const sprintOptions = sprintsDisponiveis(options.sprints, filters.projetoIds);
  const appliedTags = etiquetasDoRecorte(applied, options);
  const cards = [
    {
      label: "Projetos ativos",
      value: summary?.projetosAtivos,
      hint: summary ? `${summary.projetos} projetos no total` : "",
    },
    {
      label: "Clientes atendidos",
      value: summary?.clientes,
      hint: "Clientes com projetos no recorte",
    },
    {
      label: "Custo total",
      value: summary ? money(summary.custo) : null,
      hint: summary
        ? `${summary.horasSemCusto > 0 ? "Parcial · " : ""}Base ${money(summary.custoBase)} + bonificação ${money(summary.bonificacao)}`
        : "Custo de mão de obra com bonificação",
    },
    {
      label: "Horas trabalhadas",
      value: summary ? `${number(summary.horas)} h` : null,
      hint: "Todos os status de apontamento",
    },
    {
      label: "Assertividade média do orçamento",
      value: summary ? percent(summary.assertividade) : null,
      hint:
        summary?.assertividade != null
          ? `Média de ${summary.projetosComAssertividade} projetos com base de cálculo`
          : "Sem base de comparação integral",
    },
    {
      label: "Ocorrências de auditoria",
      value: summary?.totalOcorrencias,
      hint: "Pendências financeiras, de equipe e de tarefas",
    },
  ];

  return (
    <section className="content-panel dashboard-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Visão geral</span>
          <div className="dashboard-title-row">
            <h1>Dashboard Geral</h1>
            <DashboardHelp />
          </div>
        </div>
        <PageActions
          onRefresh={() => {
            loadSummary();
            loadOptions();
          }}
          loading={loading}
        />
      </header>

      <form
        className="dashboard-overview"
        onSubmit={(event) => {
          event.preventDefault();
          loadSummary({ ...filters });
        }}
      >
        <div className="dashboard-filter-card">
          <div className="dashboard-toolbar">
            <div className="dashboard-quick-dates">
              <label className="field">
                <span>Data inicial</span>
                <input
                  type="date"
                  name="dataInicio"
                  value={filters.dataInicio}
                  max={filters.dataFim || "9999-12-31"}
                  onChange={updateFilter}
                  disabled={loading}
                />
              </label>
              <label className="field">
                <span>Data final</span>
                <input
                  type="date"
                  name="dataFim"
                  value={filters.dataFim}
                  min={filters.dataInicio || undefined}
                  max="9999-12-31"
                  onChange={updateFilter}
                  disabled={loading}
                />
              </label>
            </div>
            <div className="dashboard-quick-periods" role="group" aria-label="Períodos rápidos">
              {PERIODOS_RAPIDOS.map(({ chave, rotulo }) => {
                const datas = periodoRapido(chave);
                const ativo =
                  applied.dataInicio === datas.dataInicio && applied.dataFim === datas.dataFim;
                return (
                  <button
                    key={chave}
                    type="button"
                    className={`dashboard-chip${ativo ? " is-selected" : ""}`}
                    aria-pressed={ativo}
                    disabled={loading}
                    title={ativo ? "Clique de novo para ver todos os períodos" : undefined}
                    onClick={() => applyPeriod(ativo ? { dataInicio: "", dataFim: "" } : datas)}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>
            {changed && (
              <button type="submit" className="primary-button" disabled={loading}>
                Aplicar
              </button>
            )}
            <button
              type="button"
              className="secondary-button dashboard-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="dashboard-filtros"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Filter size={16} aria-hidden="true" />
              <span>Filtros</span>
              {filtered && (
                <span
                  className="dashboard-filter-count"
                  aria-label={`${appliedTags.length} aplicados`}
                >
                  {appliedTags.length}
                </span>
              )}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary-button dashboard-export"
              disabled={loading || exporting || changed || !data}
              onClick={exportExcel}
              title={
                changed
                  ? "Aplique os filtros antes de exportar."
                  : "Baixar os indicadores do recorte aplicado em Excel"
              }
            >
              <FileSpreadsheet size={16} />
              {exporting ? "Gerando planilha…" : "Exportar Excel"}
            </button>
          </div>
          <div
            id="dashboard-filtros"
            className={`client-form-reveal dashboard-filter-reveal${filtersOpen ? " is-open" : ""}`}
            inert={!filtersOpen ? true : undefined}
            aria-hidden={!filtersOpen}
          >
            <div className="client-form-inner">
              <div className="dashboard-filters dashboard-filters-general">
                <label className="field">
                  <span>Cliente</span>
                  <select
                    name="clienteId"
                    value={filters.clienteId}
                    onChange={updateFilter}
                    disabled={loading || Boolean(optionsError)}
                  >
                    <option value="">Todos os clientes</option>
                    {options.clientes.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span id="filtro-projetos-rotulo">Projetos</span>
                  <MultiSelect
                    id="filtro-projetos"
                    name="projetoIds"
                    options={projectOptions}
                    value={filters.projetoIds}
                    onChange={updateFilter}
                    placeholder="Todos os projetos"
                    plural="projetos"
                    labelledBy="filtro-projetos-rotulo"
                    disabled={loading || Boolean(optionsError)}
                  />
                </div>
                <label className="field">
                  <span>Colaborador</span>
                  <select
                    name="colaboradorId"
                    value={filters.colaboradorId}
                    onChange={updateFilter}
                    disabled={loading || Boolean(optionsError)}
                  >
                    <option value="">Todos os colaboradores</option>
                    {options.colaboradores.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.nomeCompleto}
                        {person.status === "INATIVO" ? " (inativo)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Sprint</span>
                  <select
                    name="sprintId"
                    value={filters.sprintId}
                    onChange={updateFilter}
                    disabled={loading || filters.projetoIds.length !== 1}
                    title={
                      filters.projetoIds.length === 1
                        ? undefined
                        : "Escolha um único projeto para filtrar por sprint."
                    }
                  >
                    <option value="">
                      {filters.projetoIds.length === 1 ? "Todas as sprints" : "Escolha um projeto"}
                    </option>
                    {sprintOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.nome}
                        {row.statusRegistro === "INATIVO" ? " (arquivada)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    Equipe <small>(departamento)</small>
                  </span>
                  <select
                    name="equipe"
                    value={filters.equipe}
                    onChange={updateFilter}
                    disabled={loading || Boolean(optionsError)}
                  >
                    <option value="">Todas as equipes</option>
                    {options.equipes.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Status do projeto</span>
                  <select
                    name="statusProjeto"
                    value={filters.statusProjeto}
                    onChange={updateFilter}
                    disabled={loading}
                  >
                    <option value="">Todos os estados</option>
                    {projectStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dashboard-filter-actions">
                  <button type="submit" className="primary-button" disabled={loading}>
                    <Filter size={16} />
                    Aplicar filtros
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={loading || (!changed && !filtered)}
                    onClick={() => {
                      setFilters(emptyFilters);
                      loadSummary(emptyFilters);
                    }}
                  >
                    <RotateCcw size={16} />
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="dashboard-scope" role="status">
          {loading
            ? "Carregando indicadores…"
            : changed
              ? "Há filtros alterados. Clique em Aplicar para atualizar os dados."
              : filtered
                ? "Exibindo o recorte aplicado. O período considera a data dos apontamentos."
                : "Projetos ativos em todos os períodos, clientes e equipes. Outros estados estão disponíveis no filtro."}
        </p>
        {!loading && !changed && filtered && (
          <ul className="dashboard-tags" aria-label="Filtros aplicados">
            {appliedTags.map((tag) => (
              <li key={tag.chave} title={tag.completo}>
                <span>{tag.rotulo}:</span> {tag.valor}
              </li>
            ))}
          </ul>
        )}
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
      </form>

      {data && summary?.projetos > 0 && (
        <section
          className="dashboard-charts-block"
          aria-busy={loading}
          aria-labelledby="dashboard-graficos-titulo"
        >
          <h2 id="dashboard-graficos-titulo">Visão em gráficos</h2>
          <p>
            Mesmo recorte dos indicadores abaixo. Os valores de cada gráfico também estão nas
            tabelas das seções de detalhe.
          </p>
          <Suspense fallback={<p role="status">Carregando gráficos…</p>}>
            <DashboardCharts
              data={data}
              recortado={Boolean(
                applied.dataInicio ||
                applied.dataFim ||
                applied.equipe ||
                applied.colaboradorId ||
                applied.sprintId,
              )}
            />
          </Suspense>
        </section>
      )}

      <section className="dashboard-indicators" aria-labelledby="dashboard-indicadores-titulo">
        <h2 id="dashboard-indicadores-titulo" className="dashboard-operational-title">
          Indicadores gerais
        </h2>
        <div className="summary-grid dashboard-summary" aria-busy={loading}>
          {cards.map(({ label, value, hint }) => (
            <article className="summary-card" key={label}>
              <span>{label}</span>
              <strong>{loading ? "…" : (value ?? "—")}</strong>
              <small>{hint}</small>
            </article>
          ))}
        </div>
        <h2 className="dashboard-operational-title">Indicadores operacionais</h2>
        <OperationalMetrics summary={summary} loading={loading} context={Boolean(applied.equipe)} />
      </section>

      {data && (
        <PendenciasCusto
          ocorrencias={data.ocorrencias}
          onVerTodas={() => {
            setOpenSection("auditoria");
            requestAnimationFrame(() =>
              document
                .getElementById("dashboard-auditoria")
                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          }}
        />
      )}

      {!loading && data && !summary.projetos && (
        <p className="dashboard-empty" role="status">
          Nenhum registro encontrado
        </p>
      )}
      <div className="dashboard-sections" aria-label="Detalhes do dashboard">
        {sections.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`secondary-button dashboard-section-button${openSection === key ? " is-selected" : ""}`}
            aria-expanded={openSection === key}
            aria-controls={`dashboard-${key}`}
            id={`dashboard-toggle-${key}`}
            onClick={() => setOpenSection((current) => (current === key ? null : key))}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        ))}
      </div>

      {sections.map(({ key, label }) => (
        <div
          key={key}
          id={`dashboard-${key}`}
          role="region"
          aria-labelledby={`dashboard-toggle-${key}`}
          className={`client-form-reveal${openSection === key ? " is-open" : ""}`}
          inert={openSection !== key ? true : undefined}
          aria-hidden={openSection !== key}
        >
          <div className="client-form-inner">
            <section className="dashboard-detail" aria-busy={loading}>
              <h2>{label}</h2>
              {loading ? (
                <p role="status">Carregando…</p>
              ) : !data ? (
                <p>Atualize o dashboard para carregar os dados.</p>
              ) : !summary.projetos ? (
                <p className="dashboard-empty">Nenhum registro encontrado</p>
              ) : (
                <>
                  {key === "projetos" && (
                    <>
                      <div
                        className="dashboard-chart"
                        role="img"
                        aria-label="Custo por projeto, separado em custo base e bonificação; horas e valores disponíveis na tabela abaixo."
                      >
                        {openSection === key && (
                          <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
                            <DashboardProjectChart projects={data.projetos} />
                          </Suspense>
                        )}
                      </div>
                      <div className="dashboard-table">
                        <table>
                          <caption>Custo e horas por projeto</caption>
                          <thead>
                            <tr>
                              <th>Projeto</th>
                              <th>Cliente</th>
                              <th>Status</th>
                              <th>Horas</th>
                              <th>Custo base</th>
                              <th>Bonificação</th>
                              <th>Custo total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.projetos.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <Link to={`/dashboard/projetos/${row.id}`}>{row.nome}</Link>
                                </td>
                                <td>{row.cliente}</td>
                                <td>{projectStatusLabel(row.status)}</td>
                                <td>{number(row.horas)} h</td>
                                <td>{money(row.custoBase)}</td>
                                <td>
                                  <Bonus row={row} />
                                </td>
                                <td>
                                  <Cost row={row} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {key === "auditoria" && (
                    <>
                      <AuditTable occurrences={data.ocorrencias} />
                      <div className="dashboard-table">
                        <table>
                          <caption>
                            Projetos da menor para a maior assertividade do orçamento; sem base de
                            cálculo ao final.
                          </caption>
                          <thead>
                            <tr>
                              <th>Projeto</th>
                              <th>Orçamento</th>
                              <th>Bonificação</th>
                              <th>Custo total</th>
                              <th>Assertividade do orçamento</th>
                              <th>Pendências de cálculo</th>
                              <th>Horas sem custo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.auditoria.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <Link to={`/dashboard/projetos/${row.id}`}>{row.nome}</Link>
                                </td>
                                <td>{money(row.orcamento)}</td>
                                <td>
                                  <Bonus row={row} />
                                </td>
                                <td>
                                  <Cost row={row} />
                                </td>
                                <td>{percent(row.assertividade)}</td>
                                <td>{row.inconsistencias}</td>
                                <td>{number(row.horasSemCusto)} h</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {key === "inconsistencias" && (
                    <div className="dashboard-table">
                      <table>
                        <caption>
                          Projetos com mais ocorrências primeiro. A ordem pela assertividade do
                          orçamento continua na Auditoria operacional.
                        </caption>
                        <thead>
                          <tr>
                            <th>Posição</th>
                            <th>Projeto</th>
                            <th>Ocorrências</th>
                            {issueColumns.map(([type, title]) => (
                              <th key={type}>{title}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(data.rankingInconsistencias ?? []).map((row, index) => (
                            <tr key={row.id}>
                              <td>{row.total ? `${index + 1}º` : "—"}</td>
                              <td>
                                <Link to={`/dashboard/projetos/${row.id}`}>{row.nome}</Link>
                              </td>
                              <td>
                                <strong>{row.total}</strong>
                              </td>
                              {issueColumns.map(([type]) => (
                                <td key={type}>{row.porTipo[type] ?? 0}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {key === "equipes" &&
                    (!data.equipes?.length ? (
                      <p className="dashboard-empty">Sem apontamentos no recorte.</p>
                    ) : (
                      <div className="dashboard-table">
                        <table>
                          <caption>
                            Equipe é o departamento do colaborador. Cada apontamento conta uma vez,
                            mesmo em tarefas com vários responsáveis.
                          </caption>
                          <thead>
                            <tr>
                              <th>Equipe (departamento)</th>
                              <th>Colaboradores</th>
                              <th>Projetos</th>
                              <th>Horas trabalhadas</th>
                              <th>Custo base</th>
                              <th>Bonificação</th>
                              <th>Custo total</th>
                              <th>Pendências nas horas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.equipes.map((row) => (
                              <tr key={row.equipe}>
                                <td>{row.equipe}</td>
                                <td>{row.colaboradores}</td>
                                <td>{row.projetos}</td>
                                <td>{number(row.horas)} h</td>
                                <td>{money(row.custoBase)}</td>
                                <td>
                                  <Bonus row={row} />
                                </td>
                                <td>
                                  <Cost row={row} />
                                </td>
                                <td>{row.pendencias}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  {key === "clientes" && (
                    <div className="dashboard-table">
                      <table>
                        <caption>Consolidação dos projetos por cliente</caption>
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Projetos</th>
                            <th>Horas trabalhadas</th>
                            <th>Custo base</th>
                            <th>Bonificação</th>
                            <th>Custo total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.clientes.map((row) => (
                            <tr key={row.id}>
                              <td>{row.nome}</td>
                              <td>{row.projetos}</td>
                              <td>{number(row.horas)} h</td>
                              <td>{money(row.custoBase)}</td>
                              <td>
                                <Bonus row={row} />
                              </td>
                              <td>
                                <Cost row={row} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      ))}
    </section>
  );
}
