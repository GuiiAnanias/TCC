import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  ShieldCheck,
  Target,
  WalletCards,
} from "lucide-react";
import { api } from "../api/client.js";
import { FloatingActions } from "../components/FloatingActions.jsx";
import { AuditTable, OperationalMetrics } from "../components/OperationalDashboard.jsx";
import { DashboardHelp } from "../components/DashboardHelp.jsx";
import { Link } from "react-router-dom";
import { mensagemDeErro, salvarArquivo } from "../utils/download.js";

const DashboardProjectChart = lazy(() => import("../components/DashboardProjectChart.jsx"));

const emptyFilters = { dataInicio: "", dataFim: "", clienteId: "", equipe: "", statusProjeto: "" };
const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const percent = (value) => (value == null ? "Indisponível" : `${number(value)}%`);
const sections = [
  { key: "projetos", label: "Comparativo por projeto", icon: BarChart3 },
  { key: "auditoria", label: "Auditoria operacional", icon: ShieldCheck },
  { key: "clientes", label: "Resumo por cliente", icon: Building2 },
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

export function DashboardPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [data, setData] = useState(null);
  const [options, setOptions] = useState({ clientes: [], equipes: [] });
  const [optionsError, setOptionsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState(null);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);
  const appliedRef = useRef(emptyFilters);

  const loadSummary = useCallback(async (nextFilters = appliedRef.current) => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(nextFilters).filter(([, value]) => value !== ""),
      );
      const response = await api.get("/dashboard", { params });
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

  const loadOptions = useCallback(async () => {
    try {
      const response = await api.get("/dashboard/opcoes");
      setOptions(response.data);
      setOptionsError("");
    } catch {
      setOptionsError(
        "Não foi possível carregar as opções de cliente e equipe. Atualize para tentar novamente.",
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
  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(applied).filter(([, value]) => value !== ""),
      );
      const response = await api.get("/relatorios/indicadores.xlsx", {
        params,
        responseType: "blob",
      });
      salvarArquivo(response, "indicadores-codebi.xlsx");
    } catch (err) {
      setError(await mensagemDeErro(err, "Não foi possível gerar a planilha. Tente novamente."));
    } finally {
      setExporting(false);
    }
  }

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  const summary = data?.resumo;
  const filtered = Object.values(applied).some(Boolean);
  const changed = Object.keys(filters).some((key) => filters[key] !== applied[key]);
  const cards = [
    {
      label: "Projetos ativos",
      value: summary?.projetosAtivos,
      icon: BriefcaseBusiness,
      hint: summary ? `${summary.projetos} projetos no total` : "",
    },
    {
      label: "Clientes atendidos",
      value: summary?.clientes,
      icon: Building2,
      hint: "Clientes com projetos no recorte",
    },
    {
      label: "Custo total",
      value: summary ? money(summary.custo) : null,
      icon: WalletCards,
      hint: summary
        ? `${summary.horasSemCusto > 0 ? "Parcial · " : ""}Base ${money(summary.custoBase)} + bonificação ${money(summary.bonificacao)}`
        : "Custo de mão de obra com bonificação",
    },
    {
      label: "Horas trabalhadas",
      value: summary ? `${number(summary.horas)} h` : null,
      icon: Clock3,
      hint: "Todos os status de apontamento",
    },
    {
      label: "Assertividade média do orçamento",
      value: summary ? percent(summary.assertividade) : null,
      icon: Target,
      hint:
        summary?.assertividade != null
          ? `Média de ${summary.projetosComAssertividade} projetos com base de cálculo`
          : "Sem base de comparação integral",
    },
    {
      label: "Ocorrências de auditoria",
      value: summary?.totalOcorrencias,
      icon: AlertTriangle,
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
        <FloatingActions
          onRefresh={() => {
            loadSummary();
            loadOptions();
          }}
          loading={loading}
        />
      </header>

      <div className="dashboard-overview">
        <form
          className="dashboard-filters"
          onSubmit={(event) => {
            event.preventDefault();
            loadSummary({ ...filters });
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
                  onChange={updateFilter}
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
                />
              </label>
            </div>
          </fieldset>
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
              <option value="">Ativos e inativos</option>
              <option value="ATIVO">Ativos</option>
              <option value="INATIVO">Inativos</option>
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
        </form>
        <p className="dashboard-scope" role="status">
          {loading
            ? "Carregando indicadores…"
            : changed
              ? "Há filtros alterados. Clique em Aplicar filtros para atualizar os dados."
              : filtered
                ? "Exibindo o recorte aplicado. O período considera a data dos apontamentos."
                : "Todos os períodos, clientes e equipes. Inclui projetos ativos e inativos."}
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
          {cards.map(({ label, value, icon: Icon, hint }) => (
            <article className="summary-card" key={label}>
              <div className="summary-icon">
                <Icon size={22} aria-hidden="true" />
              </div>
              <div>
                <span>{label}</span>
                <strong>{loading ? "…" : (value ?? "—")}</strong>
                <small>{hint}</small>
              </div>
            </article>
          ))}
        </div>
        <h2 className="dashboard-operational-title">Indicadores operacionais</h2>
        <OperationalMetrics summary={summary} loading={loading} context={Boolean(applied.equipe)} />
      </div>

      {!loading && summary?.registrosSemVinculo > 0 && (
        <div className="feedback warning" role="status">
          <div>
            {summary.registrosSemVinculo === 1
              ? "Há 1 apontamento sem participação de equipe válida"
              : `Há ${summary.registrosSemVinculo} apontamentos sem participação de equipe válida`}{" "}
            na data das horas. O custo foi calculado pelo valor/hora, sem bonificação nesses
            apontamentos. <Link to="/projetos">Conferir equipe e datas em Projetos</Link>. Isso não
            exige cadastrar uma bonificação.
          </div>
        </div>
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
                        aria-label="Comparação de custo em reais e horas trabalhadas por projeto; valores disponíveis na tabela abaixo."
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
                                <td>{row.status === "ATIVO" ? "Ativo" : "Inativo"}</td>
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
