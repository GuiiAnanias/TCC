import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BriefcaseBusiness, Building2, UsersRound, WalletCards } from "lucide-react";
import { api } from "../api/client.js";
import { FloatingActions } from "../components/FloatingActions.jsx";

const summaryCards = [
  { key: "clientes", label: "Clientes", endpoint: "/clientes", icon: Building2 },
  { key: "colaboradores", label: "Colaboradores", endpoint: "/colaboradores", icon: UsersRound },
  { key: "remuneracoes", label: "Itens de remuneração", endpoint: "/remuneracoes", icon: WalletCards },
  { key: "projetos", label: "Projetos", endpoint: "/projetos", icon: BriefcaseBusiness }
];

function countActive(items) {
  return items.filter((item) => item.status === "ATIVO").length;
}

export function DashboardPage() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.allSettled(
        summaryCards.map((card) =>
          api.get(card.endpoint).then((response) => ({
            key: card.key,
            data: response.data
          }))
        )
      );
      const successfulResponses = responses
        .filter((response) => response.status === "fulfilled")
        .map((response) => [response.value.key, response.value.data]);

      setData(Object.fromEntries(successfulResponses));

      if (responses.some((response) => response.status === "rejected")) {
        setError("Não foi possível carregar todos os dados. Verifique se a API e o banco estão rodando.");
      }
    } catch {
      setError("Não foi possível carregar o resumo do sistema.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const totals = useMemo(
    () =>
      summaryCards.map((card) => {
        const items = data[card.key] || [];
        return {
          ...card,
          total: items.length,
          active: countActive(items)
        };
      }),
    [data]
  );

  const activeProjects = totals.find((item) => item.key === "projetos")?.active || 0;
  const activeCollaborators = totals.find((item) => item.key === "colaboradores")?.active || 0;

  return (
    <section className="content-panel">
      <header className="page-header">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Dashboard</h1>
        </div>
        <FloatingActions onRefresh={loadSummary} loading={loading} />
      </header>

      {error ? (
        <div className="feedback error">
          <Activity size={18} />
          {error}
        </div>
      ) : null}

      <div className="summary-grid">
        {totals.map((card) => {
          const Icon = card.icon;

          return (
            <article className="summary-card" key={card.key}>
              <div className="summary-icon">
                <Icon size={22} />
              </div>
              <div>
                <span>{card.label}</span>
                <strong>{loading ? "-" : card.total}</strong>
                <small>{loading ? "Carregando" : `${card.active} ativos`}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="insight-panel">
        <div>
          <span className="eyebrow">Operação</span>
          <h2>Base centralizada para gestão</h2>
        </div>
        <p>
          O sistema centraliza cadastros essenciais para análise operacional:
          clientes, colaboradores, projetos, equipes e tabela de remuneração.
        </p>
        <div className="insight-metrics">
          <span>{activeProjects} projetos ativos</span>
          <span>{activeCollaborators} colaboradores ativos</span>
        </div>
      </div>
    </section>
  );
}
