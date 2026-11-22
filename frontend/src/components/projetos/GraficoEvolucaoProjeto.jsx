/**
 * [COMPONENTE] Gráfico da aba Evolução do projeto: custo mensal, custo acumulado e linha do
 * orçamento.
 */

import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { larguraEixoValores } from "../../utils/dadosGraficos.js";

const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compact = (value) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const reais = (value) => `R$ ${compact(value)}`;

/** Custo de cada mês (base + bonificação) e custo acumulado, com a linha do orçamento. */
export default function GraficoEvolucaoProjeto({ rows, budget, label }) {
  const highest = Math.max(budget || 0, ...rows.map((row) => row.custoAcumulado));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={rows}
        margin={{ top: 16, right: 24, bottom: 20, left: 16 }}
        accessibilityLayer
      >
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        <XAxis dataKey="mes" tickFormatter={label} tick={{ fill: "var(--muted)", fontSize: 12 }} />
        <YAxis
          domain={[0, Math.ceil(highest * 1.1) || 1]}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickFormatter={reais}
          width={larguraEixoValores([highest], reais, { minimo: 80 })}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            borderColor: "var(--line)",
            borderRadius: 10,
            color: "var(--text)",
          }}
          labelFormatter={label}
          formatter={(value, name) => [money(value), name]}
        />
        <Legend />
        <Bar
          dataKey="custoBase"
          name="Custo base do mês"
          stackId="mes"
          fill="var(--primary)"
          maxBarSize={56}
        />
        <Bar
          dataKey="bonificacao"
          name="Bonificação do mês"
          stackId="mes"
          fill="var(--warning)"
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        />
        <Line
          dataKey="custoAcumulado"
          name="Custo acumulado"
          stroke="var(--info)"
          strokeWidth={2}
          dot={{ r: 3 }}
          type="monotone"
        />
        {budget > 0 && (
          <ReferenceLine
            y={budget}
            stroke="var(--danger)"
            strokeDasharray="6 4"
            label={{
              value: `Orçamento ${money(budget)}`,
              position: "insideTopLeft",
              fill: "var(--danger)",
              fontSize: 12,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
