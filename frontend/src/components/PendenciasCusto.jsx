/**
 * [COMPONENTE] Aviso "apontamentos com custo incompleto" do Dashboard Geral, com os botões que
 * levam à correção.
 */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { dataBr, pendenciasDeCusto } from "../utils/pendencias.js";

const LIMITE = 5;

/**
 * Aviso do Dashboard Geral sobre apontamentos com custo incompleto. Mostra quem, em qual
 * projeto e data, o que falta e um botão que abre a equipe do projeto ou o financeiro do
 * colaborador já indicando o ajuste. Os demais ficam na seção Auditoria operacional.
 */
export function PendenciasCusto({ ocorrencias, onVerTodas }) {
  const pendencias = pendenciasDeCusto(ocorrencias);
  if (!pendencias.length) return null;
  const total = pendencias.length;
  return (
    <section className="cost-issues" aria-labelledby="pendencias-custo-titulo">
      <header>
        <TriangleAlert size={20} aria-hidden="true" />
        <div>
          <h2 id="pendencias-custo-titulo">
            {total === 1
              ? "1 apontamento com custo incompleto"
              : `${total} apontamentos com custo incompleto`}
          </h2>
          <p>
            Por isso o custo total aparece como parcial. Cada linha mostra o que falta e abre o
            lugar certo para corrigir.
          </p>
        </div>
      </header>
      <ul>
        {pendencias.slice(0, LIMITE).map((row) => (
          <li key={row.chave ?? `${row.tipo}:${row.apontamentoId}`}>
            <div className="cost-issue-text">
              <strong>{row.colaborador}</strong>
              <span>
                {row.projeto} · {dataBr(row.data)}
              </span>
              <small>{row.problema}</small>
            </div>
            <Link className="secondary-button" to={row.link}>
              {row.acao}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {total > LIMITE && (
        <button type="button" className="cost-issues-more" onClick={onVerTodas}>
          Ver todas as {total} na Auditoria operacional
        </button>
      )}
    </section>
  );
}
