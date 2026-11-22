/**
 * [COMPONENTE] Visão em gráficos do Dashboard Geral (Recharts): custo por mês, orçamento x custo,
 * rosca de horas e de tarefas por status e rankings. Os dados vêm de utils/dadosGraficos.js.
 */

import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { issueLabels } from "./DashboardOperacional.jsx";
import {
  STATUS_APONTAMENTO,
  STATUS_TAREFA,
  contar,
  fatias,
  larguraEixoValores,
  mesCurto,
  mesLongo,
  orcamentoPorProjeto,
  principaisEOutros,
  ranking,
} from "../../utils/dadosGraficos.js";

const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compact = (value) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const horas = (value) => `${number(value)} h`;
// Espaço sem quebra: o rótulo da barra não pode partir "R$" e o número em duas linhas.
const reaisCurto = (value) => `R$\u00a0${compact(value)}`;
// Legenda na mesma ordem das barras (o padrão do gráfico é a ordem alfabética).
const naOrdem =
  (...chaves) =>
  (item) =>
    chaves.indexOf(item.dataKey);
// Corta o rótulo do eixo para caber em uma linha. Maiúsculas são mais largas, então
// contam mais no limite (que é dado em "letras minúsculas").
function truncar(texto, limite = 22) {
  let largura = 0;
  for (let indice = 0; indice < texto.length; indice++) {
    largura += /[A-ZÀ-Ý]/.test(texto[indice]) ? 1.3 : 1;
    if (largura > limite) return `${texto.slice(0, Math.max(1, indice - 1))}…`;
  }
  return texto;
}

// Cores por categoria, em ordem fixa (a cor acompanha a categoria, nunca a posição no ranking).
const COR = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const eixo = { fill: "var(--muted)", fontSize: 12 };
const grade = <CartesianGrid stroke="var(--line)" vertical={false} />;
const gradeHorizontal = <CartesianGrid stroke="var(--line)" horizontal={false} />;

// [COMPONENTE] Dica (tooltip) dos gráficos com os valores do ponto.
function Dica({ active, payload, label, titulo, linhas }) {
  if (!active || !payload?.length) return null;
  const dados = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{titulo ? titulo(dados, label) : label}</strong>
      <dl>
        {linhas(dados).map(([nome, valor, cor]) => (
          <div key={nome}>
            <dt>
              {cor && <span className="chart-swatch" style={{ background: cor }} />}
              {nome}
            </dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// [COMPONENTE] Moldura de cada gráfico: título, subtítulo e aviso quando não há dados.
function Cartao({ titulo, subtitulo, vazio, children, nota, className = "" }) {
  return (
    <article className={`chart-card ${className}`}>
      <header>
        <h3>{titulo}</h3>
        {subtitulo && <p>{subtitulo}</p>}
      </header>
      {vazio ? <p className="chart-empty">Sem dados no recorte aplicado.</p> : children}
      {nota && !vazio && <p className="chart-note">{nota}</p>}
    </article>
  );
}

// No cartão pequeno cabem até 12 barras legíveis; o valor em cima de cada barra só até 6.
const MESES_NO_GRAFICO = 12;
const MESES_COM_ROTULO = 6;

// [TELA] Colunas empilhadas: custo base e bonificação de cada mês.
function CustoPorMes({ evolucao }) {
  const ocultos = Math.max(0, evolucao.length - MESES_NO_GRAFICO);
  const dados = evolucao
    .slice(-MESES_NO_GRAFICO)
    .map((row) => ({ ...row, rotulo: mesCurto(row.mes) }));
  return (
    <Cartao
      titulo="Custo por mês"
      subtitulo="Custo base e bonificação dos apontamentos de cada mês"
      vazio={!dados.length}
      nota={
        ocultos > 0
          ? `Últimos ${MESES_NO_GRAFICO} meses com apontamentos. Use o período para ver meses anteriores.`
          : ""
      }
    >
      <div
        className="chart-area"
        role="img"
        aria-label={`Custo por mês: ${dados.map((row) => `${mesLongo(row.mes)}, ${money(row.custo)}`).join("; ")}.`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={dados}
            margin={{ top: 24, right: 4, bottom: 0, left: 0 }}
            accessibilityLayer
          >
            {grade}
            <XAxis
              dataKey="rotulo"
              tick={eixo}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              interval="preserveStartEnd"
              minTickGap={4}
            />
            <YAxis
              tick={eixo}
              tickLine={false}
              axisLine={false}
              width={larguraEixoValores(
                dados.map((row) => row.custo),
                reaisCurto,
              )}
              tickFormatter={(value) => reaisCurto(value)}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-soft)" }}
              content={
                <Dica
                  titulo={(row) => mesLongo(row.mes)}
                  linhas={(row) => [
                    ["Custo base", money(row.custoBase), COR[0]],
                    ["Bonificação", money(row.bonificacao), COR[1]],
                    ["Custo total", money(row.custo)],
                    ["Horas", horas(row.horas)],
                  ]}
                />
              }
            />
            <Legend
              iconType="circle"
              itemSorter={naOrdem("custoBase", "bonificacao")}
              wrapperStyle={{ fontSize: 13, color: "var(--text-secondary)" }}
            />
            <Bar
              isAnimationActive={false}
              dataKey="custoBase"
              name="Custo base"
              stackId="custo"
              fill={COR[0]}
              stroke="var(--surface)"
              strokeWidth={2}
              maxBarSize={48}
            />
            <Bar
              isAnimationActive={false}
              dataKey="bonificacao"
              name="Bonificação"
              stackId="custo"
              fill={COR[1]}
              stroke="var(--surface)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            >
              {dados.length <= MESES_COM_ROTULO && (
                <LabelList
                  dataKey="custo"
                  position="top"
                  formatter={(value) => reaisCurto(value)}
                  style={{ fill: "var(--text-secondary)", fontSize: 12 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

// [TELA] Barras em pares: orçamento integral x custo do recorte por projeto.
function OrcamentoXCusto({ projetos, recortado }) {
  const { itens, ocultos } = orcamentoPorProjeto(projetos);
  const altura = Math.max(160, itens.length * 64 + 56);
  return (
    <Cartao
      titulo="Orçamento × custo por projeto"
      subtitulo="Projetos com maior custo no recorte"
      vazio={!itens.length}
      className="chart-card-wide"
      nota={[
        recortado &&
          "Com filtro de período, equipe, colaborador ou sprint, o custo é só o do recorte; o orçamento é sempre o valor integral do projeto.",
        ocultos > 0 &&
          `Mais ${ocultos} ${ocultos === 1 ? "projeto" : "projetos"} na tabela do comparativo.`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="chart-area"
        role="img"
        aria-label={`Orçamento e custo por projeto: ${itens.map((row) => `${row.nome}, orçamento ${money(row.orcamento)}, custo ${money(row.custo)}`).join("; ")}.`}
      >
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart
            data={itens}
            layout="vertical"
            margin={{ top: 4, right: 64, bottom: 4, left: 8 }}
            barGap={2}
            barCategoryGap="28%"
            accessibilityLayer
          >
            {gradeHorizontal}
            <XAxis
              type="number"
              tick={eixo}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => reaisCurto(value)}
            />
            <YAxis
              type="category"
              dataKey="nome"
              width={170}
              tick={eixo}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              tickFormatter={(value) => truncar(value, 21)}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-soft)" }}
              content={
                <Dica
                  linhas={(row) => [
                    ["Orçamento", money(row.orcamento), COR[0]],
                    ["Custo", money(row.custo), COR[1]],
                  ]}
                />
              }
            />
            <Legend
              iconType="circle"
              itemSorter={naOrdem("orcamento", "custo")}
              wrapperStyle={{ fontSize: 13, color: "var(--text-secondary)" }}
            />
            <Bar
              isAnimationActive={false}
              dataKey="orcamento"
              name="Orçamento"
              fill={COR[0]}
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
            >
              <LabelList
                dataKey="orcamento"
                position="right"
                formatter={(value) => reaisCurto(value)}
                style={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
            </Bar>
            <Bar
              isAnimationActive={false}
              dataKey="custo"
              name="Custo"
              fill={COR[1]}
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
            >
              <LabelList
                dataKey="custo"
                position="right"
                formatter={(value) => reaisCurto(value)}
                style={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

// Pizza (rosca) com legenda que mostra nome, valor e percentual de cada fatia.
function Rosca({ titulo, subtitulo, categorias, valorDe, formatar, centro }) {
  const { total, itens } = fatias(categorias, valorDe);
  const visiveis = itens.map((item, indice) => ({ ...item, cor: COR[indice] }));
  return (
    <Cartao titulo={titulo} subtitulo={subtitulo} vazio={!total}>
      <div className="chart-donut">
        <div
          className="chart-donut-plot"
          role="img"
          aria-label={`${titulo}: ${visiveis.map((item) => `${item.nome}, ${formatar(item.valor)} (${number(item.percentual)}%)`).join("; ")}.`}
        >
          <ResponsiveContainer width="100%" height={200}>
            <PieChart accessibilityLayer>
              <Pie
                data={visiveis.filter((item) => item.valor > 0)}
                dataKey="valor"
                nameKey="nome"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={visiveis.filter((item) => item.valor > 0).length > 1 ? 2 : 0}
                stroke="var(--surface)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {visiveis
                  .filter((item) => item.valor > 0)
                  .map((item) => (
                    <Cell key={item.chave} fill={item.cor} />
                  ))}
              </Pie>
              <Tooltip
                content={
                  <Dica
                    titulo={(item) => item.nome}
                    linhas={(item) => [
                      [formatar === horas ? "Horas" : "Quantidade", formatar(item.valor), item.cor],
                      ["Participação", `${number(item.percentual)}%`],
                    ]}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-donut-center" aria-hidden="true">
            <strong>{formatar(total)}</strong>
            <span>{centro}</span>
          </div>
        </div>
        <ul className="chart-legend">
          {visiveis.map((item) => (
            <li key={item.chave}>
              <span className="chart-swatch" style={{ background: item.cor }} />
              <span className="chart-legend-name">{item.nome}</span>
              <span className="chart-legend-value">
                {formatar(item.valor)} <small>{number(item.percentual)}%</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Cartao>
  );
}

// Barras horizontais do maior para o menor, numa cor só, com o valor no fim de cada barra.
// `itens` é o ranking completo: o gráfico mostra os maiores e resume o resto num botão
// "Outros", que abre a lista inteira (com rolagem) sem distorcer a escala das barras.
// `eixo` é a largura dos nomes e `margem` o espaço mínimo do valor no fim da barra.
function Ranking({
  titulo,
  subtitulo,
  itens,
  formatar,
  nota,
  eixo: larguraEixo = 150,
  margem = 72,
  plural = "itens",
}) {
  const [todos, setTodos] = useState(false);
  const { principais, outros } = principaisEOutros(itens);
  const visiveis = todos ? itens : principais;
  const altura = Math.max(120, visiveis.length * 40 + 24);
  // O valor no fim da barra maior precisa caber inteiro (ex.: "R$ 657.004,84").
  const maiorRotulo = Math.max(0, ...visiveis.map((item) => formatar(item.valor).length));
  const margemDireita = Math.max(margem, Math.ceil(maiorRotulo * 7.2) + 12);
  return (
    <Cartao titulo={titulo} subtitulo={subtitulo} vazio={!itens.length} nota={nota}>
      <div
        className={todos ? "chart-area chart-area-rolagem" : "chart-area"}
        role="img"
        aria-label={`${titulo}: ${visiveis.map((item) => `${item.nome}, ${formatar(item.valor)}`).join("; ")}${outros && !todos ? `; outros ${outros.quantidade} ${plural}, ${formatar(outros.valor)}` : ""}.`}
      >
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart
            data={visiveis}
            layout="vertical"
            margin={{ top: 0, right: margemDireita, bottom: 0, left: 8 }}
            barCategoryGap="30%"
            accessibilityLayer
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={larguraEixo}
              tick={eixo}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              tickFormatter={(value) => truncar(value, Math.round(larguraEixo / 8.3))}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-soft)" }}
              content={<Dica linhas={(item) => [[titulo, formatar(item.valor), COR[0]]]} />}
            />
            <Bar
              isAnimationActive={false}
              dataKey="valor"
              name={titulo}
              fill={COR[0]}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            >
              {visiveis.map((item) => (
                <Cell key={item.nome} fill={item.outros ? "var(--chart-muted)" : COR[0]} />
              ))}
              <LabelList
                dataKey="valor"
                position="right"
                formatter={formatar}
                style={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {outros && (
        <button
          type="button"
          className="chart-more"
          aria-expanded={todos}
          onClick={() => setTodos((atual) => !atual)}
        >
          {todos ? (
            <span>Mostrar só os {principais.length} maiores</span>
          ) : (
            <>
              <span>
                Outros {outros.quantidade} {plural} · <strong>{formatar(outros.valor)}</strong>
              </span>
              <span className="chart-more-acao">Ver todos ({itens.length})</span>
            </>
          )}
        </button>
      )}
    </Cartao>
  );
}

/**
 * Gráficos do Dashboard Geral. Usam os mesmos dados e o mesmo recorte dos cartões; os
 * valores de cada gráfico também aparecem nas tabelas das seções de detalhe abaixo.
 */
export default function GraficosDashboard({ data, recortado = false }) {
  const tarefasPorStatus = contar(data.tarefas, (tarefa) => tarefa.status);
  const ocorrenciasPorTipo = contar(data.ocorrencias, (ocorrencia) => ocorrencia.tipo);
  const porStatus = new Map(
    (data.apontamentosPorStatus ?? []).map((row) => [row.status, row.horas]),
  );
  return (
    <div className="dashboard-charts">
      <CustoPorMes evolucao={data.evolucao ?? []} />
      <Rosca
        titulo="Horas por status do apontamento"
        subtitulo="Quanto das horas já foi aprovado e faturado"
        categorias={STATUS_APONTAMENTO}
        valorDe={(status) => porStatus.get(status) ?? 0}
        formatar={horas}
        centro="horas"
      />
      <Rosca
        titulo="Tarefas por status"
        subtitulo="Tarefas dos projetos no recorte"
        categorias={STATUS_TAREFA}
        valorDe={tarefasPorStatus}
        formatar={number}
        centro="tarefas"
      />
      <Ranking
        titulo="Custo por cliente"
        subtitulo="Do maior para o menor custo"
        itens={ranking(data.clientes ?? [], {
          valor: (row) => row.custo,
          nome: (row) => row.nome,
          limite: Infinity,
        })}
        formatar={money}
        plural="clientes"
      />
      <Ranking
        titulo="Horas por equipe"
        subtitulo="Equipe é o departamento do colaborador"
        itens={ranking(data.equipes ?? [], {
          valor: (row) => row.horas,
          nome: (row) => row.equipe,
          limite: Infinity,
        })}
        formatar={horas}
        plural="equipes"
      />
      <Ranking
        titulo="Ocorrências de auditoria por tipo"
        subtitulo="Pendências que deixam custos ou indicadores incompletos"
        itens={ranking(Object.entries(issueLabels), {
          valor: ([tipo]) => ocorrenciasPorTipo(tipo),
          nome: ([, rotulo]) => rotulo,
          limite: Infinity,
        })}
        plural="tipos"
        formatar={number}
        eixo={190}
        margem={36}
        nota="Detalhes de cada ocorrência na seção Auditoria operacional."
      />
      <OrcamentoXCusto projetos={data.projetos} recortado={recortado} />
    </div>
  );
}
