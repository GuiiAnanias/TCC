/**
 * [COMPONENTE] Seção de Histórico da tela de Apontamento de Horas: lista apontamentos modificados
 * e excluídos, com filtros para as duas situações (Modificado e Excluído), busca, colaborador,
 * projeto e período.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { api } from "../../api/conexao.js";
import { PaginacaoTabela, usePaginacao } from "../comum/PaginacaoTabela.jsx";
import { SelecaoComBusca } from "../comum/SelecaoComBusca.jsx";

const ROTULO_STATUS = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  FATURADO: "Faturado",
};

const SITUACOES = [
  { value: "", label: "Todas as situações" },
  { value: "MODIFICADO", label: "Modificado" },
  { value: "EXCLUIDO", label: "Excluído" },
];

const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));

const dataBr = (value) => {
  if (!value) return "—";
  return String(value).slice(0, 10).split("-").reverse().join("/");
};

const dataHora = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

function descreverMudancas(item) {
  const ant = item.dadosAnteriores || {};
  const novo = item.dadosNovos || {};
  if (item.situacao === "EXCLUIDO") {
    return [
      `Status ao excluir: ${ROTULO_STATUS[ant.status ?? item.status] ?? item.status}`,
      `Descrição: "${ant.descricao ?? item.descricao}"`,
    ];
  }

  const mudancas = [];
  if (ant.colaboradorId !== novo.colaboradorId && novo.colaboradorNome) {
    mudancas.push(`Colaborador: ${ant.colaboradorNome || "—"} → ${novo.colaboradorNome}`);
  }
  if (ant.projetoId !== novo.projetoId && novo.projetoNome) {
    mudancas.push(`Projeto: ${ant.projetoNome || "—"} → ${novo.projetoNome}`);
  }
  if ((ant.tarefaId ?? null) !== (novo.tarefaId ?? null)) {
    mudancas.push(
      `Tarefa: ${ant.tarefaTitulo || "Sem tarefa"} → ${novo.tarefaTitulo || "Sem tarefa"}`,
    );
  }
  if (ant.data && novo.data && String(ant.data).slice(0, 10) !== String(novo.data).slice(0, 10)) {
    mudancas.push(`Data: ${dataBr(ant.data)} → ${dataBr(novo.data)}`);
  }
  if (
    ant.horas !== undefined &&
    novo.horas !== undefined &&
    Number(ant.horas) !== Number(novo.horas)
  ) {
    mudancas.push(`Horas: ${number(ant.horas)} h → ${number(novo.horas)} h`);
  }
  if (ant.status && novo.status && ant.status !== novo.status) {
    mudancas.push(
      `Status: ${ROTULO_STATUS[ant.status] ?? ant.status} → ${ROTULO_STATUS[novo.status] ?? novo.status}`,
    );
  }
  if ((ant.descricao ?? "") !== (novo.descricao ?? "")) {
    mudancas.push(`Descrição: "${ant.descricao || "—"}" → "${novo.descricao || "—"}"`);
  }

  if (!mudancas.length) {
    mudancas.push(`Registro atualizado (${ROTULO_STATUS[item.status] ?? item.status})`);
  }
  return mudancas;
}

const filtrosIniciais = {
  situacao: "",
  busca: "",
  colaboradorId: "",
  projetoId: "",
  dataInicio: "",
  dataFim: "",
};

export function HistoricoApontamentos({ colaboradores = [], projetos = [], refreshSignal = 0 }) {
  const [filters, setFilters] = useState(filtrosIniciais);
  const [items, setItems] = useState([]);
  const paginacao = usePaginacao(items);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const carregar = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/apontamentos/historico", {
        params: {
          situacao: filters.situacao || undefined,
          busca: filters.busca.trim() || undefined,
          colaboradorId: filters.colaboradorId || undefined,
          projetoId: filters.projetoId || undefined,
          dataInicio: filters.dataInicio || undefined,
          dataFim: filters.dataFim || undefined,
        },
      });
      if (current === requestId.current) {
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (current === requestId.current) {
        setError(
          err.response?.data?.errors?.[0]?.message ||
            err.response?.data?.message ||
            "Não foi possível carregar o histórico de apontamentos.",
        );
      }
    } finally {
      if (current === requestId.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    carregar();
  }, [carregar, refreshSignal]);

  const temFiltro = Boolean(
    filters.situacao ||
    filters.busca ||
    filters.colaboradorId ||
    filters.projetoId ||
    filters.dataInicio ||
    filters.dataFim,
  );

  return (
    <div className="entries-history">
      <div className="table-panel">
        <div className="table-toolbar entries-history-toolbar">
          <div
            className="entries-history-situations"
            role="group"
            aria-label="Filtrar por situação"
          >
            {SITUACOES.map((opcao) => {
              const ativo = filters.situacao === opcao.value;
              return (
                <button
                  key={opcao.value || "TODAS"}
                  type="button"
                  className={ativo ? "primary-button" : "secondary-button"}
                  aria-pressed={ativo}
                  onClick={() => setFilters((current) => ({ ...current, situacao: opcao.value }))}
                >
                  {opcao.label}
                </button>
              );
            })}
          </div>

          <div className="entries-history-filters">
            <label className="search-field">
              <Search size={18} />
              <input
                value={filters.busca}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, busca: event.target.value }))
                }
                placeholder="Buscar por colaborador, projeto, tarefa ou descrição..."
                aria-label="Buscar no histórico de apontamentos"
              />
            </label>

            <SelecaoComBusca
              id="historico-colaborador"
              ariaLabel="Filtrar por colaborador"
              name="colaboradorId"
              options={[
                { value: "", label: "Todos os colaboradores" },
                ...colaboradores.map((colaborador) => ({
                  value: String(colaborador.id),
                  label: colaborador.nomeCompleto,
                })),
              ]}
              value={filters.colaboradorId}
              placeholder="Todos os colaboradores"
              onChange={(event) =>
                setFilters((current) => ({ ...current, colaboradorId: event.target.value }))
              }
            />

            <SelecaoComBusca
              id="historico-projeto"
              ariaLabel="Filtrar por projeto"
              name="projetoId"
              options={[
                { value: "", label: "Todos os projetos" },
                ...projetos.map((projeto) => ({
                  value: String(projeto.id),
                  label: projeto.nome,
                })),
              ]}
              value={filters.projetoId}
              placeholder="Todos os projetos"
              onChange={(event) =>
                setFilters((current) => ({ ...current, projetoId: event.target.value }))
              }
            />

            {temFiltro && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFilters(filtrosIniciais)}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="feedback error" role="alert">
            {error}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data do evento</th>
                <th>Situação</th>
                <th>Colaborador</th>
                <th>Projeto e tarefa</th>
                <th>Data e horas</th>
                <th>Detalhes do registro</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="empty-cell" colSpan={6}>
                    {loading
                      ? "Carregando histórico de apontamentos..."
                      : temFiltro
                        ? "Nenhum registro encontrado no histórico com esses filtros."
                        : "Nenhuma modificação ou exclusão de apontamento registrada até o momento."}
                  </td>
                </tr>
              ) : (
                paginacao.itensPaginados.map((item) => {
                  const mudancas = descreverMudancas(item);
                  const excluido = item.situacao === "EXCLUIDO";
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{dataHora(item.createdAt)}</strong>
                        <span className="report-history-note">
                          Por {item.usuario?.nomeUsuario || "Sistema"} · Apontamento #
                          {item.apontamentoId}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status ${excluido ? "status-excluido" : "status-modificado"}`}
                        >
                          {excluido ? "Excluído" : "Modificado"}
                        </span>
                      </td>
                      <td title={item.colaboradorNome}>{item.colaboradorNome}</td>
                      <td title={`${item.projetoNome} — ${item.tarefaTitulo || "Sem tarefa"}`}>
                        <strong>{item.projetoNome}</strong>
                        <span className="report-history-note">
                          {item.tarefaTitulo || "Sem tarefa"}
                        </span>
                      </td>
                      <td>
                        <strong>{dataBr(item.data)}</strong>
                        <span className="report-history-note">{number(item.horas)} h</span>
                      </td>
                      <td title={mudancas.join(" | ")}>
                        <ul className="entries-history-changes">
                          {mudancas.map((texto, idx) => (
                            <li key={idx} title={texto}>
                              {texto}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginacaoTabela
          pagina={paginacao.pagina}
          totalPaginas={paginacao.totalPaginas}
          totalItens={paginacao.totalItens}
          inicio={paginacao.inicio}
          fim={paginacao.fim}
          onPageChange={paginacao.setPagina}
          rotulo="Páginas do histórico de apontamentos"
        />
      </div>
    </div>
  );
}
