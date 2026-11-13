// Dados dos gráficos do Dashboard Geral, separados da tela para poderem ser testados.
// Todos partem da resposta de GET /api/dashboard, com o mesmo recorte dos cartões.

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" vira "out/26". */
export function mesCurto(mes) {
  const [ano, numero] = String(mes).split("-");
  return `${MESES[Number(numero) - 1] ?? numero}/${String(ano).slice(2)}`;
}

/** "2026-10" vira "outubro de 2026". */
export function mesLongo(mes) {
  const [ano, numero] = String(mes).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, numero - 1, 1)));
}

/**
 * Do maior para o menor valor, só com valores acima de zero. Passando do limite, o resto
 * vira uma barra "Outros", para o gráfico não ficar ilegível com muitas categorias.
 */
export function ranking(lista, { valor, nome, limite = 8 }) {
  const itens = lista
    .map((item) => ({ nome: nome(item), valor: Number(valor(item)) || 0 }))
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  if (itens.length <= limite) return itens;
  const primeiros = itens.slice(0, limite - 1);
  const resto = itens.slice(limite - 1);
  return [
    ...primeiros,
    {
      nome: `Outros (${resto.length})`,
      valor: Math.round(resto.reduce((soma, item) => soma + item.valor, 0) * 100) / 100,
      outros: true,
    },
  ];
}

/** Fatias com o percentual de cada uma, na ordem fixa das categorias (a cor segue a categoria). */
export function fatias(categorias, valorDe) {
  const itens = categorias.map(({ chave, rotulo }) => ({
    chave,
    nome: rotulo,
    valor: Number(valorDe(chave)) || 0,
  }));
  const total = itens.reduce((soma, item) => soma + item.valor, 0);
  return {
    total,
    itens: itens.map((item) => ({
      ...item,
      percentual: total ? Math.round((item.valor / total) * 1000) / 10 : 0,
    })),
  };
}

export const STATUS_APONTAMENTO = [
  { chave: "PENDENTE", rotulo: "Pendente" },
  { chave: "APROVADO", rotulo: "Aprovado" },
  { chave: "FATURADO", rotulo: "Faturado" },
];

export const STATUS_TAREFA = [
  { chave: "PLANEJADA", rotulo: "Planejada" },
  { chave: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { chave: "CONCLUIDA", rotulo: "Concluída" },
  { chave: "CANCELADA", rotulo: "Cancelada" },
];

export function contar(lista, chave) {
  const contagem = new Map();
  for (const item of lista ?? []) contagem.set(chave(item), (contagem.get(chave(item)) ?? 0) + 1);
  return (valor) => contagem.get(valor) ?? 0;
}

/**
 * Orçamento integral × custo do recorte, por projeto, dos que têm orçamento ou custo.
 * Os maiores custos primeiro; passando do limite, mostra só os maiores.
 */
export function orcamentoPorProjeto(projetos, limite = 8) {
  const itens = (projetos ?? [])
    .filter((projeto) => projeto.orcamento > 0 || projeto.custo > 0)
    .map((projeto) => ({
      id: projeto.id,
      nome: projeto.nome,
      orcamento: Number(projeto.orcamento) || 0,
      custo: Number(projeto.custo) || 0,
    }))
    .sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome, "pt-BR"));
  return { itens: itens.slice(0, limite), ocultos: Math.max(0, itens.length - limite) };
}
