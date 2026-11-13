/**
 * [COMPONENTE] Gráfico do Comparativo por projeto (custo base e bonificação), carregado só quando a
 * seção é aberta.
 */

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compact = (value) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function Dica({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <dl>
        <div>
          <dt>
            <span className="chart-swatch" style={{ background: "var(--chart-1)" }} />
            Custo base
          </dt>
          <dd>{money(row.custoBase)}</dd>
        </div>
        <div>
          <dt>
            <span className="chart-swatch" style={{ background: "var(--chart-2)" }} />
            Bonificação
          </dt>
          <dd>{money(row.bonificacao)}</dd>
        </div>
        <div>
          <dt>Custo total</dt>
          <dd>{money(row.custo)}</dd>
        </div>
        <div>
          <dt>Horas trabalhadas</dt>
          <dd>{number(row.horas)} h</dd>
        </div>
      </dl>
    </div>
  );
}

// Custo por projeto em um único eixo (reais). As horas aparecem na dica e na tabela abaixo:
// dois eixos com escalas diferentes no mesmo gráfico sugerem relações que os dados não têm.
export default function DashboardProjectChart({ projects }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={projects}
        margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
        accessibilityLayer
      >
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="nome"
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          interval="preserveStartEnd"
          tickFormatter={(value) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
        />
        <YAxis
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `R$\u00a0${compact(value)}`}
          width={80}
        />
        <Tooltip cursor={{ fill: "var(--surface-soft)" }} content={<Dica />} />
        <Legend
          iconType="circle"
          itemSorter={(item) => ["custoBase", "bonificacao"].indexOf(item.dataKey)}
          wrapperStyle={{ fontSize: 13, color: "var(--text-secondary)" }}
        />
        <Bar
          isAnimationActive={false}
          dataKey="custoBase"
          name="Custo base"
          stackId="cost"
          fill="var(--chart-1)"
          stroke="var(--surface)"
          strokeWidth={2}
          maxBarSize={56}
        />
        <Bar
          isAnimationActive={false}
          dataKey="bonificacao"
          name="Bonificação"
          stackId="cost"
          fill="var(--chart-2)"
          stroke="var(--surface)"
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
