import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileChartColumn, FileDown, FileSpreadsheet, Play, X } from "lucide-react";
import { api } from "../api/client.js";
import { PageActions } from "../components/PageActions.jsx";
import { HelpDialog } from "../components/HelpDialog.jsx";
import { ReportScopeSelect } from "../components/ReportScopeSelect.jsx";
import { ReportCustomizationDialog } from "../components/ReportCustomizationDialog.jsx";
import { ReportTabs } from "../components/ReportTabs.jsx";
import { BLOCOS } from "../config/reportBlocks.js";
export { BLOCOS } from "../config/reportBlocks.js";
import { projectStatusLabel } from "../config/projectOptions.js";
import { salvarArquivo } from "../utils/download.js";
import { falhaDoArquivo, sucessoDoArquivo } from "../utils/relatorioArquivos.js";

const TIPOS_OCORRENCIA = {
  SEM_REMUNERACAO: "Sem valor/hora",
  SEM_VINCULO: "Sem participação na equipe",
  SEM_TAREFA: "Horas sem tarefa",
  SEM_ESTIMATIVA: "Tarefa sem estimativa",
  CONCLUIDA_SEM_HORAS: "Tarefa concluída sem horas",
};
const STATUS_HORAS = { PENDENTE: "Pendente", APROVADO: "Aprovado", FATURADO: "Faturado" };
const formularioVazio = () => ({
  projetoIds: [],
  clienteIds: [],
  dataInicio: "",
  dataFim: "",
  blocos: BLOCOS.map((bloco) => bloco.key),
});

const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const percent = (value) => (value == null ? "Indisponível" : `${number(value)}%`);
const dataBr = (value) => value.slice(0, 10).split("-").reverse().join("/");
const dataHora = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export function textoPeriodo({ dataInicio, dataFim }) {
  if (dataInicio && dataFim) return `${dataBr(dataInicio)} a ${dataBr(dataFim)}`;
  if (dataInicio) return `A partir de ${dataBr(dataInicio)}`;
  if (dataFim) return `Até ${dataBr(dataFim)}`;
  return "Todos os períodos";
}

/** Mensagem do primeiro problema do formulário, ou vazio quando pode gerar. */
export function validarFormulario(form) {
  if (!form.projetoIds.length && !form.clienteIds?.length && !form.dataInicio && !form.dataFim)
    return "Selecione ao menos um filtro para gerar o relatório.";
  if (form.dataInicio && form.dataFim && form.dataFim < form.dataInicio)
    return "A data final não pode ser anterior à inicial.";
  if (!form.blocos.length) return "Selecione ao menos um bloco de dados para o relatório.";
  return "";
}

const FORMATOS_ARQUIVO = { pdf: "PDF", xlsx: "Excel" };

function mensagemDeErro(error, padrao) {
  return error.response?.data?.errors?.[0]?.message || error.response?.data?.message || padrao;
}

export function RelatoriosPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(formularioVazio);
  const [projetos, setProjetos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [personalizando, setPersonalizando] = useState(false);
  const [opcoesErro, setOpcoesErro] = useState("");
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [baixando, setBaixando] = useState("");
  const [retornoArquivo, setRetornoArquivo] = useState(null);
  const pedido = useRef(null);
  const relatorioAtual = useRef(null);
  relatorioAtual.current = relatorio;

  const carregarOpcoes = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard/opcoes");
      setProjetos(data.projetos ?? []);
      setClientes(data.clientes ?? []);
      setOpcoesErro("");
    } catch (error) {
      setOpcoesErro(mensagemDeErro(error, "Não foi possível carregar a lista de projetos."));
    }
  }, []);

  const carregarRelatorio = useCallback(async (relatorioId, signal) => {
    setCarregando(true);
    setErro("");
    try {
      const { data } = await api.get(`/relatorios/${relatorioId}`, { signal });
      if (!signal?.aborted) setRelatorio(data);
    } catch (error) {
      if (signal?.aborted) return;
      setRelatorio(null);
      setErro(mensagemDeErro(error, "Não foi possível abrir o relatório."));
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarOpcoes();
  }, [carregarOpcoes]);

  useEffect(() => {
    setPersonalizando(false);
    if (!id) {
      setRelatorio(null);
      return undefined;
    }
    // A prévia recém-gerada já veio na resposta; só consulta ao abrir pelo endereço.
    if (String(relatorioAtual.current?.id) === id) return undefined;
    const controller = new AbortController();
    carregarRelatorio(id, controller.signal);
    return () => controller.abort();
  }, [id, carregarRelatorio]);

  useEffect(() => () => pedido.current?.abort(), []);

  // O aviso de download vale só para o relatório em que foi feito.
  useEffect(() => setRetornoArquivo(null), [relatorio?.id]);

  // O arquivo é gerado no servidor a partir da mesma fotografia da prévia, com o login atual.
  async function baixar(formato) {
    setBaixando(formato);
    setRetornoArquivo(null);
    try {
      const response = await api.get(`/relatorios/${relatorio.id}/${formato}`, {
        responseType: "blob",
      });
      const nome = salvarArquivo(response, `relatorio-${relatorio.id}.${formato}`);
      setRetornoArquivo({ tipo: "success", texto: sucessoDoArquivo(formato, nome) });
    } catch (error) {
      setRetornoArquivo({
        tipo: "error",
        texto: await falhaDoArquivo(
          error,
          formato,
          `Não foi possível gerar o ${FORMATOS_ARQUIVO[formato]}. Tente novamente.`,
        ),
      });
    } finally {
      setBaixando("");
    }
  }

  function atualizar(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErro("");
  }

  function alternarBloco(key) {
    setForm((current) => ({
      ...current,
      blocos: current.blocos.includes(key)
        ? current.blocos.filter((bloco) => bloco !== key)
        : BLOCOS.map((bloco) => bloco.key).filter(
            (bloco) => bloco === key || current.blocos.includes(bloco),
          ),
    }));
    setErro("");
  }

  async function gerar(event) {
    event.preventDefault();
    const problema = validarFormulario(form);
    setAviso("");
    if (problema) {
      setErro(problema);
      return;
    }
    try {
      await criarRelatorio(form);
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível gerar o relatório."));
    }
  }

  async function criarRelatorio(escolhas) {
    if (pedido.current) return false;
    const controller = new AbortController();
    pedido.current = controller;
    setGerando(true);
    setErro("");
    setAviso("");
    try {
      const { data } = await api.post(
        "/relatorios",
        {
          projetoIds: escolhas.projetoIds.map(Number),
          ...(escolhas.clienteIds?.length ? { clienteIds: escolhas.clienteIds.map(Number) } : {}),
          dataInicio: escolhas.dataInicio || null,
          dataFim: escolhas.dataFim || null,
          blocos: escolhas.blocos,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return false;
      setForm(escolhas);
      setRelatorio(data);
      setPersonalizando(false);
      navigate(`/relatorios/${data.id}`);
      return true;
    } catch (error) {
      if (!controller.signal.aborted) throw error;
      return false;
    } finally {
      if (pedido.current === controller) {
        pedido.current = null;
        setGerando(false);
      }
    }
  }

  function cancelar() {
    if (pedido.current) {
      pedido.current.abort();
      pedido.current = null;
      setGerando(false);
      setAviso("Geração cancelada. Ajuste os filtros e gere de novo quando quiser.");
      return;
    }
    setForm(formularioVazio());
    setRelatorio(null);
    setErro("");
    setAviso("");
    if (id) navigate("/relatorios");
  }

  return (
    <section className="content-panel dashboard-page report-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dados</span>
          <div className="dashboard-title-row">
            <h1>Relatórios</h1>
            <RelatoriosHelp />
          </div>
        </div>
        <PageActions
          onRefresh={() => {
            carregarOpcoes();
            if (id) carregarRelatorio(id);
          }}
          loading={carregando || gerando}
        />
      </header>
      <ReportTabs />

      <form className="dashboard-overview report-form" onSubmit={gerar} noValidate>
        <div className="dashboard-filters report-filters">
          <div className="field report-projects">
            <span id="relatorio-projetos-rotulo">Projetos ou clientes</span>
            <ReportScopeSelect
              projetos={projetos}
              clientes={clientes}
              form={form}
              onChange={(escopo) => {
                setForm((current) => ({ ...current, ...escopo }));
                setErro("");
              }}
              disabled={gerando || carregando || Boolean(opcoesErro)}
            />
            <small>
              Clientes incluem seus projetos. As seleções se somam, sem repetir os dados.
            </small>
          </div>
          <fieldset className="dashboard-period" disabled={gerando || carregando}>
            <legend>Período</legend>
            <div>
              <label className="field">
                <span>Data inicial</span>
                <input
                  type="date"
                  name="dataInicio"
                  value={form.dataInicio}
                  max={form.dataFim || "9999-12-31"}
                  onChange={atualizar}
                />
              </label>
              <label className="field">
                <span>Data final</span>
                <input
                  type="date"
                  name="dataFim"
                  value={form.dataFim}
                  min={form.dataInicio || undefined}
                  max="9999-12-31"
                  onChange={atualizar}
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="report-blocks" disabled={gerando || carregando}>
            <legend>Blocos do relatório</legend>
            <div>
              {BLOCOS.map((bloco) => (
                <label className="tasks-check report-block" key={bloco.key}>
                  <input
                    type="checkbox"
                    checked={form.blocos.includes(bloco.key)}
                    onChange={() => alternarBloco(bloco.key)}
                  />
                  <span>
                    <strong>{bloco.label}</strong>
                    <small>{bloco.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dashboard-filter-actions">
            <button type="submit" className="primary-button" disabled={gerando || carregando}>
              <Play size={16} aria-hidden="true" />
              {gerando ? "Gerando…" : "Gerar"}
            </button>
            <button type="button" className="secondary-button" onClick={cancelar}>
              <X size={16} aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </div>
        <p className="dashboard-scope" role="status">
          {gerando
            ? "Gerando o relatório e gravando uma cópia dos dados…"
            : "Busque por projeto ou cliente e escolha os blocos. Sem seleção, informe um período para incluir todos com dados, de qualquer estado."}
        </p>
        {opcoesErro && (
          <div className="feedback error" role="alert">
            {opcoesErro}
          </div>
        )}
        {erro && (
          <div className="feedback error" role="alert">
            {erro}
          </div>
        )}
        {aviso && (
          <div className="feedback warning" role="status">
            {aviso}
          </div>
        )}
      </form>

      {carregando && (
        <p className="dashboard-scope" role="status">
          Abrindo o relatório…
        </p>
      )}
      {!carregando && relatorio && (
        <>
          <div className="report-preview-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={gerando}
              onClick={() => setPersonalizando(true)}
            >
              Personalizar relatório
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => baixar("pdf")}
              disabled={gerando || Boolean(baixando)}
            >
              <FileDown size={16} aria-hidden="true" />
              {baixando === "pdf" ? "Gerando PDF…" : "Baixar PDF"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => baixar("xlsx")}
              disabled={gerando || Boolean(baixando)}
            >
              <FileSpreadsheet size={16} aria-hidden="true" />
              {baixando === "xlsx" ? "Gerando Excel…" : "Baixar Excel"}
            </button>
          </div>
          {retornoArquivo && (
            <div
              className={`feedback ${retornoArquivo.tipo} report-download-feedback`}
              role={retornoArquivo.tipo === "error" ? "alert" : "status"}
            >
              {retornoArquivo.texto}
            </div>
          )}
          <RelatorioPrevia relatorio={relatorio} />
        </>
      )}
      {personalizando && relatorio && (
        <ReportCustomizationDialog
          relatorio={relatorio}
          onClose={() => setPersonalizando(false)}
          onApply={criarRelatorio}
        />
      )}
    </section>
  );
}

function RelatoriosHelp() {
  return (
    <HelpDialog title="Ajuda — Relatórios">
      <section>
        <h3>Gerar</h3>
        <p>
          Na mesma busca, escolha projetos ou clientes, o período e ao menos um bloco. Selecionar um
          cliente inclui seus projetos; seleções combinadas não repetem valores. Sem projetos
          escolhidos, entram todos os projetos com apontamentos ou tarefas no período, de qualquer
          estado. O período considera a data dos apontamentos.
        </p>
        <p>
          Gerar grava uma cópia dos dados do recorte, com autor, data, filtros e versão. A prévia
          mostra essa cópia: mudanças posteriores em horas, equipes ou valores não alteram um
          relatório já gerado. Para ver os números atuais, gere outro.
        </p>
      </section>
      <section>
        <h3>Personalizar</h3>
        <p>
          Depois de gerar, abra Personalizar relatório para escolher os clientes, projetos e blocos
          da nova prévia. Os dados serão consultados novamente e os totais recalculados juntos. A
          nova fotografia recebe outro número; a anterior permanece preservada.
        </p>
      </section>
      <section>
        <h3>Baixar</h3>
        <p>
          Baixar PDF e Baixar Excel geram o arquivo a partir da cópia gravada, com os mesmos números
          da prévia e só os blocos escolhidos. O nome do arquivo traz o número do relatório, os
          clientes ou projetos e o período.
        </p>
      </section>
      <section>
        <h3>Cancelar</h3>
        <p>
          Durante a geração, Cancelar para de esperar a resposta. Depois, limpa o formulário e a
          prévia. Um relatório que já foi gravado continua registrado e pode ser aberto pelo
          endereço com o número dele.
        </p>
      </section>
      <section>
        <h3>Números</h3>
        <p>
          Os valores seguem as mesmas fórmulas do Dashboard Geral. Com período, a assertividade do
          orçamento fica indisponível, porque o orçamento integral não se compara com o custo de
          parte do projeto. O relatório contém custos internos e é de uso interno.
        </p>
      </section>
    </HelpDialog>
  );
}

function Tabela({ caption, colunas, linhas, vazio }) {
  if (!linhas.length) return <p className="dashboard-empty">{vazio}</p>;
  return (
    <div className="dashboard-table">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.titulo}
                style={coluna.largura ? { minWidth: coluna.largura } : undefined}
              >
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => (
            <tr key={linha.chave ?? linha.id ?? indice}>
              {colunas.map((coluna) => (
                <td key={coluna.titulo}>{coluna.valor(linha)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Indicadores({ itens }) {
  return (
    <div className="dashboard-audit-metrics report-metrics">
      {itens.map(([rotulo, valor, nota]) => (
        <article key={rotulo}>
          <span>{rotulo}</span>
          <strong>{valor}</strong>
          {nota && <small>{nota}</small>}
        </article>
      ))}
    </div>
  );
}

const conteudoDoBloco = {
  PROJETOS: (dados) => (
    <Tabela
      caption="Projetos do recorte"
      vazio="Nenhum projeto no recorte."
      linhas={dados.linhas}
      colunas={[
        { titulo: "Projeto", valor: (row) => row.nome, largura: 110 },
        { titulo: "Cliente", valor: (row) => row.cliente, largura: 120 },
        { titulo: "Status", valor: (row) => projectStatusLabel(row.status) },
        { titulo: "Orçamento", valor: (row) => money(row.orcamento) },
        { titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
        { titulo: "Custo base", valor: (row) => money(row.custoBase) },
        { titulo: "Bonificação", valor: (row) => money(row.bonificacao) },
        {
          titulo: "Custo total",
          valor: (row) =>
            row.horasSemCusto > 0 ? `${money(row.custo)} (parcial)` : money(row.custo),
        },
        { titulo: "Assertividade do orçamento", valor: (row) => percent(row.assertividade) },
        { titulo: "Inconsistências", valor: (row) => row.inconsistencias },
      ]}
    />
  ),
  CLIENTES: (dados) => (
    <Tabela
      caption="Clientes do recorte"
      vazio="Nenhum cliente no recorte."
      linhas={dados.linhas}
      colunas={[
        { titulo: "Cliente", valor: (row) => row.nome, largura: 200 },
        { titulo: "Projetos", valor: (row) => row.projetos },
        { titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
        { titulo: "Custo base", valor: (row) => money(row.custoBase) },
        { titulo: "Bonificação", valor: (row) => money(row.bonificacao) },
        { titulo: "Custo total", valor: (row) => money(row.custo) },
      ]}
    />
  ),
  HORAS: (dados) => (
    <>
      <Indicadores
        itens={[
          ["Horas totais", `${number(dados.total)} h`, `${dados.apontamentos} apontamentos`],
          ["Horas sem custo", `${number(dados.horasSemCusto)} h`, "Sem valor/hora vigente"],
          ["Horas sem tarefa", `${number(dados.horasSemTarefa)} h`, "Correção não classificada"],
        ]}
      />
      {/* O banco devolve as chaves do JSON em outra ordem; a tabela segue o fluxo do status. */}
      <Tabela
        caption="Horas por status do apontamento"
        vazio="Sem horas no recorte."
        linhas={Object.keys(STATUS_HORAS).map((status) => ({
          chave: status,
          status,
          horas: dados.porStatus[status] ?? 0,
        }))}
        colunas={[
          { titulo: "Status", valor: (row) => STATUS_HORAS[row.status] ?? row.status },
          { titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
        ]}
      />
      <Tabela
        caption="Horas por colaborador"
        vazio="Sem apontamentos no recorte."
        linhas={dados.porColaborador}
        colunas={[
          { titulo: "Colaborador", valor: (row) => row.nome },
          { titulo: "Departamento", valor: (row) => row.departamento || "Sem departamento" },
          { titulo: "Projetos", valor: (row) => row.projetos },
          { titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
        ]}
      />
    </>
  ),
  CUSTO: (dados) => (
    <Indicadores
      itens={[
        [
          "Custo total",
          money(dados.total),
          dados.parcial ? `Parcial: ${number(dados.horasSemCusto)} h sem valor/hora` : null,
        ],
        ["Custo base", money(dados.custoBase), null],
        ["Bonificação", money(dados.bonificacao), null],
        [
          "Assertividade média do orçamento",
          percent(dados.assertividadeMedia),
          dados.assertividadeMedia == null
            ? "Sem projetos com base de cálculo no recorte"
            : `${dados.projetosComAssertividade} projeto(s) com base de cálculo`,
        ],
      ]}
    />
  ),
  INCONSISTENCIAS: (dados) => (
    <>
      <Indicadores
        itens={Object.entries(TIPOS_OCORRENCIA).map(([tipo, rotulo]) => [
          rotulo,
          dados.porTipo[tipo] ?? 0,
          null,
        ])}
      />
      <Tabela
        caption={`${dados.total} ocorrência(s) no recorte`}
        vazio="Nenhuma inconsistência no recorte."
        linhas={dados.ocorrencias}
        colunas={[
          { titulo: "Tipo", valor: (row) => TIPOS_OCORRENCIA[row.tipo] ?? row.tipo },
          { titulo: "Projeto", valor: (row) => row.projeto, largura: 160 },
          { titulo: "Colaborador ou tarefa", valor: (row) => row.colaborador || row.tarefa || "—" },
          { titulo: "Data", valor: (row) => (row.data ? dataBr(row.data) : "—") },
          { titulo: "Descrição", valor: (row) => row.descricao, largura: 220 },
        ]}
      />
    </>
  ),
};

export function RelatorioPrevia({ relatorio }) {
  const { conteudo } = relatorio;
  const escolhidos = new Set(conteudo.filtros.projetoIds ?? []);
  const nomesEscolhidos = conteudo.projetos
    .filter((row) => escolhidos.has(row.id))
    .map((row) => row.nome);
  return (
    <section className="dashboard-detail report-preview" aria-labelledby="relatorio-titulo">
      <header className="report-preview-header">
        <FileChartColumn size={22} aria-hidden="true" />
        <div>
          <h2 id="relatorio-titulo">Relatório nº {relatorio.id}</h2>
          <p>
            Gerado em {dataHora(relatorio.criadoEm)} por {relatorio.autor ?? "usuário removido"}.
            Cópia dos dados nesse momento (versão {relatorio.versao}).
          </p>
        </div>
      </header>
      <ul className="dashboard-tags" aria-label="Filtros do relatório">
        <li>
          <span>Período:</span> {textoPeriodo(conteudo.filtros)}
        </li>
        <li>
          <span>Projetos:</span>{" "}
          {nomesEscolhidos.length ? nomesEscolhidos.join(", ") : "Todos com dados no período"}
        </li>
        <li>
          <span>No recorte:</span> {conteudo.projetos.length} projeto(s)
        </li>
      </ul>
      {conteudo.blocos.map((key) => {
        const bloco = BLOCOS.find((row) => row.key === key);
        return (
          <section className="report-block-section" key={key} aria-labelledby={`bloco-${key}`}>
            <h3 id={`bloco-${key}`}>{bloco?.label ?? key}</h3>
            {conteudoDoBloco[key]?.(conteudo.dados[key])}
          </section>
        );
      })}
    </section>
  );
}
