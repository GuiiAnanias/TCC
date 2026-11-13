import { todayBusinessDate } from "./datasEmpresa.js";
import { projectStatusLabel } from "../config/opcoesProjeto.js";

// Recorte comum dos dashboards e da exportação: o que a tela guarda, o que vai para a API
// e o resumo do que está aplicado.

/** Parâmetros da API: listas viram "1,2" e filtros vazios ficam de fora. */
export function parametrosDoRecorte(filtros) {
  return Object.fromEntries(
    Object.entries(filtros)
      .map(([chave, valor]) => [chave, Array.isArray(valor) ? valor.join(",") : valor])
      .filter(([, valor]) => valor !== "" && valor !== null && valor !== undefined),
  );
}

const normalizar = (valor) =>
  Array.isArray(valor) ? [...valor].map(String).sort().join(",") : String(valor ?? "");

/** Compara dois recortes sem depender da ordem em que os projetos foram marcados. */
export function mesmoRecorte(a, b) {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...chaves].every((chave) => normalizar(a[chave]) === normalizar(b[chave]));
}

/** Projetos coerentes com o cliente e o estado escolhidos. */
export function projetosDisponiveis(projetos = [], { clienteId = "", statusProjeto = "" } = {}) {
  return projetos.filter(
    (projeto) =>
      (!clienteId || String(projeto.clienteId) === String(clienteId)) &&
      (!statusProjeto || projeto.status === statusProjeto),
  );
}

/** Cada sprint pertence a um projeto: a lista aparece com exatamente um projeto escolhido. */
export function sprintsDisponiveis(sprints = [], projetoIds = []) {
  if (projetoIds.length !== 1) return [];
  return sprints.filter((sprint) => String(sprint.projetoId) === String(projetoIds[0]));
}

/**
 * Mantém o recorte coerente depois de uma mudança: tira projetos que deixaram de valer para
 * o cliente/estado e a sprint que não pertence mais ao projeto escolhido. Sem as opções
 * carregadas, não descarta nada.
 */
export function ajustarRecorte(filtros, opcoes = {}) {
  if (!opcoes.projetos?.length || !Array.isArray(filtros.projetoIds)) return filtros;
  const validos = new Set(projetosDisponiveis(opcoes.projetos, filtros).map((p) => String(p.id)));
  const projetoIds = filtros.projetoIds.filter((id) => validos.has(String(id)));
  if (!("sprintId" in filtros)) return { ...filtros, projetoIds };
  const sprintValida = sprintsDisponiveis(opcoes.sprints, projetoIds).some(
    (sprint) => String(sprint.id) === String(filtros.sprintId),
  );
  return { ...filtros, projetoIds, sprintId: sprintValida ? filtros.sprintId : "" };
}

const dataBr = (iso) => iso.split("-").reverse().join("/");

function textoPeriodo({ dataInicio, dataFim }) {
  if (dataInicio && dataFim) return `${dataBr(dataInicio)} a ${dataBr(dataFim)}`;
  if (dataInicio) return `A partir de ${dataBr(dataInicio)}`;
  return `Até ${dataBr(dataFim)}`;
}

const nomeDe = (lista, id, campo = "nome") =>
  lista?.find((item) => String(item.id) === String(id))?.[campo] ?? `#${id}`;

/** Etiquetas do recorte aplicado, na mesma ordem dos controles da tela. */
export function etiquetasDoRecorte(filtros, opcoes = {}) {
  const etiquetas = [];
  if (filtros.dataInicio || filtros.dataFim)
    etiquetas.push({ chave: "periodo", rotulo: "Período", valor: textoPeriodo(filtros) });
  if (filtros.clienteId)
    etiquetas.push({
      chave: "clienteId",
      rotulo: "Cliente",
      valor: nomeDe(opcoes.clientes, filtros.clienteId),
    });
  if (filtros.projetoIds?.length) {
    const nomes = filtros.projetoIds.map((id) => nomeDe(opcoes.projetos, id));
    etiquetas.push({
      chave: "projetoIds",
      rotulo: nomes.length === 1 ? "Projeto" : "Projetos",
      valor: nomes.length <= 2 ? nomes.join(", ") : `${nomes.length} projetos`,
      completo: nomes.join(", "),
    });
  }
  if (filtros.colaboradorId)
    etiquetas.push({
      chave: "colaboradorId",
      rotulo: "Colaborador",
      valor: nomeDe(opcoes.colaboradores, filtros.colaboradorId, "nomeCompleto"),
    });
  if (filtros.sprintId)
    etiquetas.push({
      chave: "sprintId",
      rotulo: "Sprint",
      valor: nomeDe(opcoes.sprints, filtros.sprintId),
    });
  if (filtros.equipe)
    etiquetas.push({ chave: "equipe", rotulo: "Equipe (departamento)", valor: filtros.equipe });
  if ("statusProjeto" in filtros)
    etiquetas.push({
      chave: "statusProjeto",
      rotulo: "Status do projeto",
      valor: filtros.statusProjeto ? projectStatusLabel(filtros.statusProjeto) : "Todos os estados",
    });
  return etiquetas;
}

// Atalhos de período da barra do Dashboard Geral. As datas seguem o calendário da empresa
// (o mesmo dos apontamentos), não o fuso do navegador.
const iso = (data) => data.toISOString().slice(0, 10);
const diaUtc = (texto) => new Date(`${texto}T00:00:00Z`);
const somarDias = (texto, dias) => {
  const data = diaUtc(texto);
  data.setUTCDate(data.getUTCDate() + dias);
  return iso(data);
};
const fimDoMes = (ano, mes) => iso(new Date(Date.UTC(ano, mes + 1, 0)));

export const PERIODOS_RAPIDOS = [
  { chave: "mes-atual", rotulo: "Mês atual" },
  { chave: "ultimos-30", rotulo: "Últimos 30 dias" },
  { chave: "mes-anterior", rotulo: "Mês anterior" },
  { chave: "ano-atual", rotulo: "Este ano" },
];

/** Datas de um atalho de período, a partir da data de hoje ("AAAA-MM-DD"). */
export function periodoRapido(chave, hoje = todayBusinessDate()) {
  const [ano, mes] = hoje.split("-").map(Number);
  if (chave === "mes-atual")
    return { dataInicio: `${hoje.slice(0, 7)}-01`, dataFim: fimDoMes(ano, mes - 1) };
  if (chave === "ultimos-30") return { dataInicio: somarDias(hoje, -29), dataFim: hoje };
  if (chave === "mes-anterior") {
    const inicio = new Date(Date.UTC(ano, mes - 2, 1));
    return {
      dataInicio: iso(inicio),
      dataFim: fimDoMes(inicio.getUTCFullYear(), inicio.getUTCMonth()),
    };
  }
  if (chave === "ano-atual") return { dataInicio: `${ano}-01-01`, dataFim: `${ano}-12-31` };
  return { dataInicio: "", dataFim: "" };
}
