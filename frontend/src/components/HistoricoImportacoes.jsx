import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { api } from "../api/client.js";
import { date, number } from "./OperationalDashboard.jsx";
import { mensagemDeErro } from "../utils/download.js";

const POR_PAGINA = 10;
const STATUS = {
  CONCLUIDA: { rotulo: "Concluída", classe: "status-concluida" },
  FALHOU: { rotulo: "Falhou", classe: "status-falhou" },
};

const dataHora = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export const textoProjetos = (projetos = []) =>
  projetos.length ? projetos.map((projeto) => projeto.nome).join(", ") : "—";

export function textoQuantidades(item) {
  if (item.status === "CONCLUIDA")
    return `${number(item.importados)} ${item.importados === 1 ? "apontamento" : "apontamentos"} · ${number(item.horas)} h`;
  if (!item.linhas) return "Planilha não lida";
  return `${number(item.comErro)} de ${number(item.linhas)} ${item.linhas === 1 ? "linha" : "linhas"} com erro`;
}

const periodo = (intervalo) =>
  !intervalo
    ? null
    : intervalo.inicio === intervalo.fim
      ? date(intervalo.inicio)
      : `${date(intervalo.inicio)} a ${date(intervalo.fim)}`;

// Histórico das importações de planilha, concluídas e com falha. `versao` muda a cada
// importação feita na tela, para a lista voltar à primeira página já atualizada.
export function HistoricoImportacoes({ versao = 0 }) {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const pedido = useRef(0);

  const carregar = useCallback(async (paginaPedida) => {
    const atual = ++pedido.current;
    setCarregando(true);
    setErro("");
    try {
      const { data } = await api.get("/importacoes/apontamentos/historico", {
        params: { pagina: paginaPedida, porPagina: POR_PAGINA },
      });
      if (atual === pedido.current) setDados(data);
    } catch (error) {
      if (atual === pedido.current)
        setErro(await mensagemDeErro(error, "Não foi possível carregar o histórico."));
    } finally {
      if (atual === pedido.current) setCarregando(false);
    }
  }, []);

  // Nova importação: volta para a primeira página, onde ela aparece.
  useEffect(() => {
    setPagina(1);
  }, [versao]);

  useEffect(() => {
    carregar(pagina);
  }, [carregar, pagina, versao]);

  const itens = dados?.itens ?? [];

  return (
    <section className="form-panel import-history" aria-labelledby="historico-importacoes-titulo">
      <div className="import-history-header">
        <History size={18} aria-hidden="true" />
        <h2 id="historico-importacoes-titulo">Histórico de Importações</h2>
      </div>

      {erro && (
        <div className="feedback error import-history-error" role="alert">
          <span>{erro}</span>
          <button type="button" className="secondary-button" onClick={() => carregar(pagina)}>
            Tentar novamente
          </button>
        </div>
      )}

      {!dados && carregando && <p className="dashboard-empty">Carregando histórico…</p>}

      {dados && !itens.length && <p className="dashboard-empty">Nenhuma importação registrada</p>}

      {itens.length > 0 && (
        <div className="dashboard-table">
          <table>
            <caption>
              {dados.total} {dados.total === 1 ? "importação" : "importações"}, da mais recente para
              a mais antiga, incluindo as que falharam.
            </caption>
            <thead>
              <tr>
                <th>Data</th>
                <th style={{ minWidth: 180 }}>Arquivo</th>
                <th style={{ minWidth: 180 }}>Projeto</th>
                <th>Status</th>
                <th style={{ minWidth: 200 }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const status = STATUS[item.status] ?? { rotulo: item.status, classe: "" };
                const dias = periodo(item.periodo);
                return (
                  <tr key={item.id}>
                    <td>
                      {dataHora(item.criadoEm)}
                      <span className="report-history-note">
                        por {item.usuario?.nome ?? "usuário removido"}
                      </span>
                    </td>
                    <td className="import-history-file">{item.arquivo}</td>
                    <td>
                      <span className="report-history-choice" title={textoProjetos(item.projetos)}>
                        {textoProjetos(item.projetos)}
                      </span>
                    </td>
                    <td>
                      <span className={`status ${status.classe}`}>{status.rotulo}</span>
                    </td>
                    <td className="import-history-result">
                      {textoQuantidades(item)}
                      {dias && <span className="report-history-note">Horas de {dias}</span>}
                      {item.status === "FALHOU" && item.mensagem && (
                        <span className="report-history-note">{item.mensagem}</span>
                      )}
                      {item.erros.length > 0 && (
                        <details className="import-history-errors">
                          <summary>
                            Ver {item.erros.length === 1 ? "erro" : "erros"}
                            {item.comErro > item.erros.length
                              ? ` (primeiros ${item.erros.length} de ${item.comErro})`
                              : ""}
                          </summary>
                          <ul>
                            {item.erros.map((detalhe, indice) => (
                              <li key={indice}>
                                Linha {detalhe.linha}
                                {detalhe.coluna ? `, ${detalhe.coluna}` : ""}: {detalhe.mensagem}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dados && dados.paginas > 1 && (
        <nav className="report-history-pages" aria-label="Páginas do histórico de importações">
          <button
            type="button"
            className="secondary-button"
            disabled={carregando || pagina <= 1}
            onClick={() => setPagina((atual) => atual - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Anterior
          </button>
          <span>
            Página {dados.pagina} de {dados.paginas}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={carregando || pagina >= dados.paginas}
            onClick={() => setPagina((atual) => atual + 1)}
          >
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}
