/**
 * [COMPONENTE] Abas Gerar relatório / Histórico da tela de relatórios.
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FileChartColumn, History } from "lucide-react";

/** Alterna entre gerar ou abrir um relatório e consultar o histórico de relatórios gerados. */
export function AbasRelatorios() {
  const { pathname } = useLocation();
  const noHistorico = pathname.startsWith("/relatorios/historico");
  return (
    <nav className="report-tabs" aria-label="Seções de relatórios">
      <Link
        to="/relatorios"
        className={`secondary-button report-tab${noHistorico ? "" : " is-active"}`}
        aria-current={noHistorico ? undefined : "page"}
      >
        <FileChartColumn size={16} aria-hidden="true" />
        Gerar relatório
      </Link>
      <Link
        to="/relatorios/historico"
        className={`secondary-button report-tab${noHistorico ? " is-active" : ""}`}
        aria-current={noHistorico ? "page" : undefined}
      >
        <History size={16} aria-hidden="true" />
        Histórico
      </Link>
    </nav>
  );
}
