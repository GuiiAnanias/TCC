import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function DashboardProjectChart({ projects }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={projects}
        margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
        accessibilityLayer
      >
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        <XAxis
          dataKey="nome"
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          interval="preserveStartEnd"
          tickFormatter={(value) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
        />
        <YAxis
          yAxisId="cost"
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickFormatter={(value) => `R$ ${number(value)}`}
          width={90}
        />
        <YAxis
          yAxisId="hours"
          orientation="right"
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickFormatter={(value) => `${number(value)} h`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            borderColor: "var(--line)",
            borderRadius: 10,
            color: "var(--text)",
          }}
          formatter={(value, name) => [
            name === "Horas trabalhadas" ? `${number(value)} h` : money(value),
            name,
          ]}
        />
        <Legend />
        <Bar
          yAxisId="cost"
          dataKey="custoBase"
          name="Custo base"
          stackId="cost"
          fill="var(--primary)"
          maxBarSize={56}
        />
        <Bar
          yAxisId="cost"
          dataKey="bonificacao"
          name="Bonificação"
          stackId="cost"
          fill="var(--warning)"
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        />
        <Line
          yAxisId="hours"
          dataKey="horas"
          name="Horas trabalhadas"
          stroke="var(--info)"
          strokeWidth={2}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
