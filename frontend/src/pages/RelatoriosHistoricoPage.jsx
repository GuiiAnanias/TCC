/**
 * [TELA] Histórico de relatórios (/relatorios/historico): lista paginada dos relatórios gerados,
 * com filtros (projeto, período de geração, só os meus) e downloads.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Search } from "lucide-react";
import { api } from "../api/conexao.js";
import { useAutenticacao } from "../autenticacao/AutenticacaoContext.jsx";
import { AcoesPagina } from "../components/comum/AcoesPagina.jsx";
import { DialogoAjuda } from "../components/comum/DialogoAjuda.jsx";
import { AbasRelatorios } from "../components/relatorios/AbasRelatorios.jsx";
import { BLOCOS } from "../config/blocosRelatorio.js";
import { mensagemDeErro, salvarArquivo } from "../utils/baixarArquivos.js";
import { falhaDoArquivo, sucessoDoArquivo } from "../utils/relatorioArquivos.js";

const POR_PAGINA = 20;
const filtrosVazios = { projetoId: "", geradoDe: "", geradoAte: "", meus: false };
const FORMATOS = { pdf: "PDF", xlsx: "Excel" };
const semFiltros = (filtros) =>
  !filtros.projetoId && !filtros.geradoDe && !filtros.geradoAte && !filtros.meus;

const dataBr = (value) => value.slice(0, 10).split("-").reverse().join("/");
const dataHora = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export function textoPeriodoHistorico({ dataInicio, dataFim } = {}) {
  if (dataInicio && dataFim) return `${dataBr(dataInicio)} a ${dataBr(dataFim)}`;
  if (dataInicio) return `A partir de ${dataBr(dataInicio)}`;
  if (dataFim) return `Até ${dataBr(dataFim)}`;
  return "Todos os períodos";
}

/** Clientes ou projetos escolhidos, resumidos para caber na tabela. */
export function textoEscolha(item) {
  const nomes = item.clientes.length ? item.clientes : item.projetosSelecionados;
  const rotulo = item.clientes.length ? "Clientes" : "Projetos";
  if (!nomes.length) return "Todos com dados no período";
  const visiveis = nomes.slice(0, 2).join(", ");
  return `${rotulo}: ${visiveis}${nomes.length > 2 ? ` e mais ${nomes.length - 2}` : ""}`;
}

/** Lista completa da escolha, para a dica ao passar o mouse. */
export function textoEscolhaCompleto(item) {
  const nomes = item.clientes.length ? item.clientes : item.projetosSelecionados;
  return nomes.length ? nomes.join("; ") : "Todos os projetos com dados no período";
}

export function textoDownloads({ PDF, XLSX }) {
  const partes = [PDF ? `PDF (${PDF})` : null, XLSX ? `Excel (${XLSX})` : null].filter(Boolean);
  return partes.length ? partes.join(", ") : "Nenhum";
}

// [REQUISICAO] Só manda à API os filtros preenchidos; "só os meus" usa o id do usuário logado.
export function parametrosDoHistorico(filtros, pagina, usuarioId) {
  return {
    pagina,
    porPagina: POR_PAGINA,
    ...(filtros.projetoId ? { projetoId: filtros.projetoId } : {}),
    ...(filtros.geradoDe ? { geradoDe: filtros.geradoDe } : {}),
    ...(filtros.geradoAte ? { geradoAte: filtros.geradoAte } : {}),
    ...(filtros.meus && usuarioId ? { autorId: usuarioId } : {}),
  };
}

// [TELA] Componente da tela.
export function RelatoriosHistoricoPage() {
  const { user } = useAutenticacao() ?? {};
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [aplicados, setAplicados] = useState(filtrosVazios);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [projetos, setProjetos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState("");
  const [retorno, setRetorno] = useState(null);
  const pedido = useRef(0);

  // [REQUISICAO] GET /relatorios com página e filtros.
  const carregar = useCallback(async () => {
    const atual = ++pedido.current;
    setCarregando(true);
    setErro("");
    try {
      const { data } = await api.get("/relatorios", {
        params: parametrosDoHistorico(aplicados, pagina, user?.id),
      });
      if (atual === pedido.current) setDados(data);
    } catch (error) {
      if (atual === pedido.current)
        setErro(await mensagemDeErro(error, "Não foi possível carregar o histórico."));
    } finally {
      if (atual === pedido.current) setCarregando(false);
    }
  }, [aplicados, pagina, user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    api
      .get("/dashboard/opcoes")
      .then(({ data }) => setProjetos(data.projetos ?? []))
      .catch(() => setProjetos([]));
  }, []);

  function atualizar(event) {
    const { name, value, type, checked } = event.target;
    setFiltros((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function aplicar(event) {
    event.preventDefault();
    if (filtros.geradoDe && filtros.geradoAte && filtros.geradoAte < filtros.geradoDe) {
      setErro("A data final não pode ser anterior à inicial.");
      return;
    }
    setPagina(1);
    setAplicados({ ...filtros });
  }

  function limpar() {
    setFiltros(filtrosVazios);
    setPagina(1);
    setAplicados(filtrosVazios);
  }

  // [REQUISICAO] Download de um relatório da lista; a contagem de downloads é recarregada.
  async function baixar(item, formato) {
    setBaixando(`${item.id}:${formato}`);
    setRetorno(null);
    try {
      const response = await api.get(`/relatorios/${item.id}/${formato}`, {
        responseType: "blob",
      });
      const nome = salvarArquivo(response, `relatorio-${item.id}.${formato}`);
      setRetorno({ tipo: "success", texto: sucessoDoArquivo(formato, nome) });
      carregar();
    } catch (error) {
      setRetorno({
        tipo: "error",
        texto: await falhaDoArquivo(
          error,
          formato,
          `Não foi possível gerar o ${FORMATOS[formato]} do relatório nº ${item.id}.`,
        ),
      });
    } finally {
      setBaixando("");
    }
  }

  const itens = dados?.itens ?? [];
  return (
    <section className="content-panel dashboard-page report-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dados</span>
          <div className="dashboard-title-row">
            <h1>Relatórios</h1>
            <HistoricoHelp />
          </div>
        </div>
        <AcoesPagina onRefresh={carregar} loading={carregando} />
      </header>
      <AbasRelatorios />

      <form className="dashboard-overview report-history-filters" onSubmit={aplicar} noValidate>
        <div className="dashboard-filters">
          <label className="field">
            <span>Projeto</span>
            <select name="projetoId" value={filtros.projetoId} onChange={atualizar}>
              <option value="">Todos os projetos</option>
              {projetos.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nome}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="dashboard-period">
            <legend>Gerados entre</legend>
            <div>
              <label className="field">
                <span>Data inicial</span>
                <input
                  type="date"
                  name="geradoDe"
                  value={filtros.geradoDe}
                  max={filtros.geradoAte || "9999-12-31"}
                  onChange={atualizar}
                />
              </label>
              <label className="field">
                <span>Data final</span>
                <input
                  type="date"
                  name="geradoAte"
                  value={filtros.geradoAte}
                  min={filtros.geradoDe || undefined}
                  max="9999-12-31"
                  onChange={atualizar}
                />
              </label>
            </div>
          </fieldset>
          <label className="tasks-check report-history-mine">
            <input type="checkbox" name="meus" checked={filtros.meus} onChange={atualizar} />
            <span>Só os que eu gerei</span>
          </label>
          <div className="dashboard-filter-actions">
            <button type="submit" className="primary-button" disabled={carregando}>
              <Search size={16} aria-hidden="true" />
              Filtrar
            </button>
            <button type="button" className="secondary-button" onClick={limpar}>
              Limpar
            </button>
          </div>
        </div>
      </form>

      {erro && (
        <div className="feedback error" role="alert">
          {erro}
        </div>
      )}
      {retorno && (
        <div
          className={`feedback ${retorno.tipo} report-download-feedback`}
          role={retorno.tipo === "error" ? "alert" : "status"}
        >
          {retorno.texto}
        </div>
      )}

      <section className="dashboard-detail report-history" aria-busy={carregando}>
        <h2>Relatórios gerados</h2>
        {carregando && !dados ? (
          <p role="status">Carregando…</p>
        ) : !itens.length ? (
          <p className="dashboard-empty">
            {semFiltros(aplicados)
              ? "Nenhum relatório gerado."
              : "Nenhum relatório encontrado com esses filtros."}
          </p>
        ) : (
          <div className="dashboard-table">
            <table>
              <caption>
                {dados.total} {dados.total === 1 ? "relatório" : "relatórios"}, do mais recente para
                o mais antigo. Abrir mostra a cópia gravada; os arquivos saem dela.
              </caption>
              <thead>
                <tr>
                  <th>Relatório</th>
                  <th>Período</th>
                  <th style={{ minWidth: 220 }}>Recorte</th>
                  <th style={{ minWidth: 160 }}>Blocos</th>
                  <th>Downloads</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className="report-history-number" to={`/relatorios/${item.id}`}>
                        Nº {item.id}
                      </Link>
                      {item.titulo && <span className="report-history-choice">{item.titulo}</span>}
                      <span className="report-history-note">
                        {dataHora(item.criadoEm)} · {item.autor ?? "Usuário removido"}
                      </span>
                    </td>
                    <td>{textoPeriodoHistorico(item.periodo)}</td>
                    <td>
                      <span className="report-history-choice" title={textoEscolhaCompleto(item)}>
                        {textoEscolha(item)}
                      </span>
                      <span className="report-history-note">
                        {item.projetosNoRecorte}{" "}
                        {item.projetosNoRecorte === 1 ? "projeto" : "projetos"} no recorte
                      </span>
                    </td>
                    <td>
                      {item.blocos
                        .map((key) => BLOCOS.find((bloco) => bloco.key === key)?.label ?? key)
                        .join(", ")}
                    </td>
                    <td>{textoDownloads(item.exportacoes)}</td>
                    <td>
                      <div className="report-history-actions">
                        <Link className="secondary-button" to={`/relatorios/${item.id}`}>
                          Abrir
                        </Link>
                        <button
                          type="button"
                          className="icon-button"
                          title={`Baixar PDF do relatório nº ${item.id}`}
                          aria-label={`Baixar PDF do relatório nº ${item.id}`}
                          disabled={Boolean(baixando)}
                          onClick={() => baixar(item, "pdf")}
                        >
                          <FileDown size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title={`Baixar Excel do relatório nº ${item.id}`}
                          aria-label={`Baixar Excel do relatório nº ${item.id}`}
                          disabled={Boolean(baixando)}
                          onClick={() => baixar(item, "xlsx")}
                        >
                          <FileSpreadsheet size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dados && dados.paginas > 1 && (
          <nav className="report-history-pages" aria-label="Páginas do histórico">
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
    </section>
  );
}

function HistoricoHelp() {
  return (
    <DialogoAjuda title="Ajuda — Histórico de relatórios">
      <section>
        <h3>O que aparece</h3>
        <p>
          Todos os relatórios gerados, do mais recente para o mais antigo, com quem gerou, quando, o
          período, os clientes ou projetos escolhidos, os blocos e os formatos já baixados. Todas as
          contas ativas veem o histórico completo.
        </p>
      </section>
      <section>
        <h3>Abrir e baixar</h3>
        <p>
          Abrir mostra a cópia gravada na geração. Os arquivos PDF e Excel são montados de novo a
          partir dessa cópia, então trazem sempre os mesmos números, mesmo que os dados tenham
          mudado. O arquivo em si não é guardado: se o layout do PDF mudar numa versão futura, o
          conteúdo continua o mesmo.
        </p>
      </section>
      <section>
        <h3>Filtros e guarda</h3>
        <p>
          Filtre por projeto, por dias de geração ou só pelos relatórios que você gerou. A lista
          mostra 20 por página. Os relatórios não são apagados: a cópia gravada é permanente e
          protege os projetos usados contra exclusão.
        </p>
      </section>
    </DialogoAjuda>
  );
}
