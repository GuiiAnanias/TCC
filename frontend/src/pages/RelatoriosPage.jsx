/**
 * [TELA] Relatórios (/relatorios e /relatorios/:id): escolher projetos/clientes, período, filtros,
 * blocos e opções do relatório, conferir a prévia (que não é gravada), salvar no histórico (grava
 * uma cópia dos dados), personalizar e baixar PDF e Excel.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Eye,
  FileChartColumn,
  FileDown,
  FileSpreadsheet,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "../api/conexao.js";
import { AcoesPagina } from "../components/comum/AcoesPagina.jsx";
import { DialogoAjuda } from "../components/comum/DialogoAjuda.jsx";
import { SelecaoEscopoRelatorio } from "../components/relatorios/SelecaoEscopoRelatorio.jsx";
import { DialogoPersonalizacaoRelatorio } from "../components/relatorios/DialogoPersonalizacaoRelatorio.jsx";
import { AbasRelatorios } from "../components/relatorios/AbasRelatorios.jsx";
import {
  BLOCOS,
  BLOCOS_PADRAO,
  COLUNAS_PROJETOS,
  ORDENACOES,
  STATUS_HORAS,
} from "../config/blocosRelatorio.js";
export { BLOCOS } from "../config/blocosRelatorio.js";
import { projectStatusLabel, projectStatusOptions } from "../config/opcoesProjeto.js";
import { salvarArquivo } from "../utils/baixarArquivos.js";
import { falhaDoArquivo, sucessoDoArquivo } from "../utils/relatorioArquivos.js";

const TIPOS_OCORRENCIA = {
  SEM_REMUNERACAO: "Sem valor/hora",
  SEM_VINCULO: "Sem participação na equipe",
  SEM_TAREFA: "Horas sem tarefa",
  SEM_ESTIMATIVA: "Tarefa sem estimativa",
  CONCLUIDA_SEM_HORAS: "Tarefa concluída sem horas",
};
const ROTULO_STATUS_HORAS = Object.fromEntries(
  STATUS_HORAS.map((item) => [item.value, item.label]),
);
const TODOS_STATUS = STATUS_HORAS.map((item) => item.value);
const TODAS_COLUNAS = COLUNAS_PROJETOS.map((item) => item.value);
// Na prévia, listas longas mostram as primeiras linhas; o PDF e o Excel trazem todas.
const LIMITE_LINHAS_PREVIA = 200;

const formularioVazio = () => ({
  projetoIds: [],
  clienteIds: [],
  dataInicio: "",
  dataFim: "",
  blocos: [...BLOCOS_PADRAO],
  titulo: "",
  observacoes: "",
  equipe: "",
  colaboradorId: "",
  statusProjeto: "",
  statusApontamentos: [...TODOS_STATUS],
  ordenacao: "NOME",
  colunasProjetos: [...TODAS_COLUNAS],
});

const number = (value) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const percent = (value) => (value == null ? "Indisponível" : `${number(value)}%`);
const dataBr = (value) => value.slice(0, 10).split("-").reverse().join("/");
const mesBr = (mes) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
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
// [VALIDACAO] Antes de gerar: "Selecione ao menos um filtro para gerar o relatório." e "Selecione
// ao menos um bloco de dados para o relatório."
export function validarFormulario(form) {
  if (
    !form.projetoIds.length &&
    !form.clienteIds?.length &&
    !form.dataInicio &&
    !form.dataFim &&
    !form.equipe &&
    !form.colaboradorId
  )
    return "Selecione ao menos um filtro para gerar o relatório.";
  if (form.dataInicio && form.dataFim && form.dataFim < form.dataInicio)
    return "A data final não pode ser anterior à inicial.";
  if (!form.blocos.length) return "Selecione ao menos um bloco de dados para o relatório.";
  if (form.statusApontamentos && !form.statusApontamentos.length)
    return "Selecione ao menos um status das horas.";
  if (form.titulo && form.titulo.trim().length > 120)
    return "O título pode ter até 120 caracteres.";
  if (form.observacoes && form.observacoes.trim().length > 1000)
    return "As observações podem ter até 1000 caracteres.";
  return "";
}

/**
 * Corpo enviado para a prévia e para salvar. Opções no valor padrão não são enviadas, então o
 * pedido mais simples continua igual ao de antes da personalização.
 */
export function corpoDoPedido(form) {
  const status = form.statusApontamentos ?? TODOS_STATUS;
  const colunas = form.colunasProjetos ?? TODAS_COLUNAS;
  return {
    projetoIds: form.projetoIds.map(Number),
    ...(form.clienteIds?.length ? { clienteIds: form.clienteIds.map(Number) } : {}),
    dataInicio: form.dataInicio || null,
    dataFim: form.dataFim || null,
    blocos: form.blocos,
    ...(form.titulo?.trim() ? { titulo: form.titulo.trim() } : {}),
    ...(form.observacoes?.trim() ? { observacoes: form.observacoes.trim() } : {}),
    ...(form.equipe ? { equipe: form.equipe } : {}),
    ...(form.colaboradorId ? { colaboradorId: Number(form.colaboradorId) } : {}),
    ...(form.statusProjeto ? { statusProjeto: form.statusProjeto } : {}),
    ...(status.length !== TODOS_STATUS.length ? { statusApontamentos: status } : {}),
    ...(form.ordenacao && form.ordenacao !== "NOME" ? { ordenacao: form.ordenacao } : {}),
    ...(form.blocos.includes("PROJETOS") && colunas.length !== TODAS_COLUNAS.length
      ? { colunasProjetos: colunas }
      : {}),
  };
}

/** Formulário preenchido com as escolhas gravadas em um relatório (para refazê-lo). */
function formularioDoRelatorio(relatorio) {
  const { filtros = {}, opcoes = {}, blocos } = relatorio.conteudo;
  return {
    ...formularioVazio(),
    projetoIds: (filtros.projetoIds ?? []).map(String),
    clienteIds: [],
    dataInicio: filtros.dataInicio ?? "",
    dataFim: filtros.dataFim ?? "",
    blocos,
    titulo: opcoes.titulo ?? "",
    observacoes: opcoes.observacoes ?? "",
    equipe: filtros.equipe ?? "",
    colaboradorId: filtros.colaboradorId ? String(filtros.colaboradorId) : "",
    statusProjeto: filtros.statusProjeto ?? "",
    statusApontamentos: filtros.statusApontamentos ?? [...TODOS_STATUS],
    ordenacao: opcoes.ordenacao ?? "NOME",
    colunasProjetos: opcoes.colunasProjetos ?? [...TODAS_COLUNAS],
  };
}

const FORMATOS_ARQUIVO = { pdf: "PDF", xlsx: "Excel" };

function mensagemDeErro(error, padrao) {
  return error.response?.data?.errors?.[0]?.message || error.response?.data?.message || padrao;
}

// Alterna um valor numa lista mantendo a ordem de referência.
const alternar = (lista, valor, ordem) =>
  lista.includes(valor)
    ? lista.filter((item) => item !== valor)
    : ordem.filter((item) => item === valor || lista.includes(item));

// [TELA] Componente da tela.
export function RelatoriosPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(formularioVazio);
  const [projetos, setProjetos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [personalizando, setPersonalizando] = useState(false);
  const [opcoesErro, setOpcoesErro] = useState("");
  const [relatorio, setRelatorio] = useState(null);
  // Prévia ainda não gravada: o pedido que a gerou e se o formulário mudou depois dela.
  const [previa, setPrevia] = useState(null);
  const [desatualizada, setDesatualizada] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
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
      setEquipes((data.equipes ?? []).filter(Boolean));
      setColaboradores(data.colaboradores ?? []);
      setOpcoesErro("");
    } catch (error) {
      setOpcoesErro(mensagemDeErro(error, "Não foi possível carregar a lista de projetos."));
    }
  }, []);

  // [REQUISICAO] Abre um relatório gerado (GET /relatorios/:id).
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
    // O relatório recém-salvo já veio na resposta; só consulta ao abrir pelo endereço.
    if (String(relatorioAtual.current?.id) === id) return undefined;
    setPrevia(null);
    const controller = new AbortController();
    carregarRelatorio(id, controller.signal);
    return () => controller.abort();
  }, [id, carregarRelatorio]);

  useEffect(() => () => pedido.current?.abort(), []);

  // O aviso de download vale só para o relatório em que foi feito.
  useEffect(() => setRetornoArquivo(null), [relatorio?.id]);

  // O arquivo é gerado no servidor a partir da mesma fotografia da prévia, com o login atual.
  // [REQUISICAO] Download do PDF ou do Excel; mensagens de sucesso e de falha em
  // utils/relatorioArquivos.js.
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

  // Qualquer mudança depois da prévia a deixa desatualizada: salvar exige conferir de novo.
  function mudar(alteracao) {
    setForm((current) => ({ ...current, ...alteracao(current) }));
    setErro("");
    if (previa) setDesatualizada(true);
  }

  function atualizar(event) {
    const { name, value } = event.target;
    mudar(() => ({ [name]: value }));
  }

  // [REQUISICAO] Envia o pedido (prévia ou gravação) com cancelamento.
  async function enviar(tipo, corpo) {
    if (pedido.current) return null;
    const controller = new AbortController();
    pedido.current = controller;
    setGerando(tipo);
    setErro("");
    setAviso(null);
    try {
      const url = tipo === "previa" ? "/relatorios/previa" : "/relatorios";
      const { data } = await api.post(url, corpo, { signal: controller.signal });
      return controller.signal.aborted ? null : data;
    } catch (error) {
      if (!controller.signal.aborted) throw error;
      return null;
    } finally {
      if (pedido.current === controller) {
        pedido.current = null;
        setGerando("");
      }
    }
  }

  // [REQUISICAO] POST /relatorios/previa: calcula sem gravar no histórico.
  async function verPrevia(escolhas) {
    const corpo = corpoDoPedido(escolhas);
    const data = await enviar("previa", corpo);
    if (!data) return false;
    setForm(escolhas);
    setPrevia({ dados: data, corpo });
    setDesatualizada(false);
    setPersonalizando(false);
    return true;
  }

  // [VALIDACAO] Valida o formulário e mostra a prévia.
  async function gerarPrevia(event) {
    event.preventDefault();
    const problema = validarFormulario(form);
    setAviso(null);
    if (problema) {
      setErro(problema);
      return;
    }
    try {
      await verPrevia(form);
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível montar a prévia do relatório."));
    }
  }

  // [REQUISICAO] POST /relatorios com o mesmo pedido da prévia conferida; abre o relatório salvo.
  async function salvar() {
    if (!previa || desatualizada) return;
    try {
      const data = await enviar("salvar", previa.corpo);
      if (!data) return;
      setRelatorio(data);
      setPrevia(null);
      setAviso({
        tipo: "success",
        texto: `Relatório nº ${data.id} salvo no histórico. Agora você pode baixar o PDF ou o Excel.`,
      });
      navigate(`/relatorios/${data.id}`);
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar o relatório."));
    }
  }

  function descartarPrevia() {
    setPrevia(null);
    setDesatualizada(false);
    setAviso({ tipo: "warning", texto: "Prévia descartada. Nada foi salvo no histórico." });
  }

  function cancelar() {
    if (pedido.current) {
      pedido.current.abort();
      pedido.current = null;
      setGerando("");
      setAviso({
        tipo: "warning",
        texto: "Geração cancelada. Ajuste os filtros e gere de novo quando quiser.",
      });
      return;
    }
    setForm(formularioVazio());
    setRelatorio(null);
    setPrevia(null);
    setDesatualizada(false);
    setErro("");
    setAviso(null);
    if (id) navigate("/relatorios");
  }

  // Personalizar um relatório salvo monta outra prévia a partir das escolhas dele.
  async function personalizar(escolhas) {
    const base = formularioDoRelatorio(relatorio);
    return verPrevia({
      ...base,
      projetoIds: escolhas.projetoIds,
      clienteIds: [],
      blocos: escolhas.blocos,
    });
  }

  const ocupado = Boolean(gerando) || carregando;
  const temProjetos = form.blocos.includes("PROJETOS");

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
        <AcoesPagina
          onRefresh={() => {
            carregarOpcoes();
            if (id) carregarRelatorio(id);
          }}
          loading={ocupado}
        />
      </header>
      <AbasRelatorios />

      <form className="dashboard-overview report-form" onSubmit={gerarPrevia} noValidate>
        <div className="dashboard-filters report-filters">
          <div className="field report-projects">
            <span id="relatorio-projetos-rotulo">Projetos ou clientes</span>
            <SelecaoEscopoRelatorio
              projetos={projetos}
              clientes={clientes}
              form={form}
              onChange={(escopo) => mudar(() => escopo)}
              disabled={ocupado || Boolean(opcoesErro)}
            />
          </div>
          <fieldset className="dashboard-period" disabled={ocupado}>
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
          <fieldset className="report-blocks" disabled={ocupado}>
            <legend>Blocos do relatório</legend>
            <div>
              {BLOCOS.map((bloco) => (
                <label className="tasks-check report-block" key={bloco.key}>
                  <input
                    type="checkbox"
                    checked={form.blocos.includes(bloco.key)}
                    onChange={() =>
                      mudar((current) => ({
                        blocos: alternar(
                          current.blocos,
                          bloco.key,
                          BLOCOS.map((item) => item.key),
                        ),
                      }))
                    }
                  />
                  <span>
                    <strong>{bloco.label}</strong>
                    <small>{bloco.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <details className="report-options">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" />
              Personalizar conteúdo
              <small>Título, observações, filtros extras, ordenação e colunas</small>
            </summary>
            <fieldset className="report-options-grid" disabled={ocupado}>
              <label className="field report-option-wide">
                <span>Título do relatório (opcional)</span>
                <input
                  name="titulo"
                  value={form.titulo}
                  maxLength={120}
                  placeholder="Ex.: Fechamento de outubro — Cliente A"
                  onChange={atualizar}
                />
              </label>
              <label className="field report-option-wide">
                <span>Observações (opcional, saem no PDF e no Excel)</span>
                <textarea
                  name="observacoes"
                  value={form.observacoes}
                  maxLength={1000}
                  rows={3}
                  placeholder="Ex.: Valores sujeitos à aprovação das horas pendentes."
                  onChange={atualizar}
                />
              </label>
              <label className="field">
                <span>Equipe</span>
                <select name="equipe" value={form.equipe} onChange={atualizar}>
                  <option value="">Todas as equipes</option>
                  {equipes.map((equipe) => (
                    <option key={equipe} value={equipe}>
                      {equipe}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Colaborador</span>
                <select name="colaboradorId" value={form.colaboradorId} onChange={atualizar}>
                  <option value="">Todos os colaboradores</option>
                  {colaboradores.map((colaborador) => (
                    <option key={colaborador.id} value={String(colaborador.id)}>
                      {colaborador.nomeCompleto}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status do projeto</span>
                <select name="statusProjeto" value={form.statusProjeto} onChange={atualizar}>
                  <option value="">Todos os status</option>
                  {projectStatusOptions.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ordenar projetos e clientes por</span>
                <select name="ordenacao" value={form.ordenacao} onChange={atualizar}>
                  {ORDENACOES.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="report-option-checks report-option-wide">
                <legend>Status das horas que entram</legend>
                <div>
                  {STATUS_HORAS.map((status) => (
                    <label className="tasks-check" key={status.value}>
                      <input
                        type="checkbox"
                        aria-label={`Horas: ${status.label}`}
                        checked={form.statusApontamentos.includes(status.value)}
                        onChange={() =>
                          mudar((current) => ({
                            statusApontamentos: alternar(
                              current.statusApontamentos,
                              status.value,
                              TODOS_STATUS,
                            ),
                          }))
                        }
                      />
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="report-option-checks report-option-wide" disabled={!temProjetos}>
                <legend>
                  Colunas da tabela de projetos
                  {!temProjetos && " (marque o bloco Projetos para escolher)"}
                </legend>
                <div>
                  {COLUNAS_PROJETOS.map((coluna) => (
                    <label className="tasks-check" key={coluna.value}>
                      <input
                        type="checkbox"
                        aria-label={`Coluna: ${coluna.label}`}
                        checked={form.colunasProjetos.includes(coluna.value)}
                        onChange={() =>
                          mudar((current) => ({
                            colunasProjetos: alternar(
                              current.colunasProjetos,
                              coluna.value,
                              TODAS_COLUNAS,
                            ),
                          }))
                        }
                      />
                      <span>{coluna.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          </details>

          <div className="dashboard-filter-actions">
            <button type="submit" className="primary-button" disabled={ocupado}>
              <Eye size={16} aria-hidden="true" />
              {gerando === "previa" ? "Montando prévia…" : "Ver prévia"}
            </button>
            <button type="button" className="secondary-button" onClick={cancelar}>
              <X size={16} aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </div>
        <p className="dashboard-scope" role="status">
          {gerando === "previa"
            ? "Montando a prévia com os dados atuais…"
            : gerando === "salvar"
              ? "Salvando o relatório e gravando uma cópia dos dados…"
              : "Escolha o recorte e os blocos e clique em Ver prévia. Nada vai para o histórico até você conferir e clicar em Salvar no histórico."}
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
          <div className={`feedback ${aviso.tipo}`} role="status">
            {aviso.texto}
          </div>
        )}
      </form>

      {carregando && (
        <p className="dashboard-scope" role="status">
          Abrindo o relatório…
        </p>
      )}
      {!carregando && previa && (
        <>
          <div
            className={`feedback ${desatualizada ? "error" : "warning"} report-draft-notice`}
            role="status"
          >
            {desatualizada
              ? "Você mudou as escolhas depois desta prévia. Clique em Ver prévia para conferir de novo antes de salvar."
              : "Esta é só uma prévia: ainda não está no histórico. Confira os números e clique em Salvar no histórico."}
          </div>
          <div className="report-preview-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={Boolean(gerando)}
              onClick={descartarPrevia}
            >
              Descartar prévia
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={Boolean(gerando) || desatualizada}
              onClick={salvar}
            >
              <Save size={16} aria-hidden="true" />
              {gerando === "salvar" ? "Salvando…" : "Salvar no histórico"}
            </button>
          </div>
          <RelatorioPrevia relatorio={previa.dados} />
        </>
      )}
      {!carregando && !previa && relatorio && (
        <>
          <div className="report-preview-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={Boolean(gerando)}
              onClick={() => {
                setForm(formularioDoRelatorio(relatorio));
                setAviso({
                  tipo: "warning",
                  texto: `As escolhas do relatório nº ${relatorio.id} foram copiadas para o formulário. Ajuste e clique em Ver prévia.`,
                });
              }}
            >
              Usar como modelo
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={Boolean(gerando)}
              onClick={() => setPersonalizando(true)}
            >
              Personalizar relatório
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => baixar("pdf")}
              disabled={Boolean(gerando) || Boolean(baixando)}
            >
              <FileDown size={16} aria-hidden="true" />
              {baixando === "pdf" ? "Gerando PDF…" : "Baixar PDF"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => baixar("xlsx")}
              disabled={Boolean(gerando) || Boolean(baixando)}
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
        <DialogoPersonalizacaoRelatorio
          relatorio={relatorio}
          onClose={() => setPersonalizando(false)}
          onApply={personalizar}
        />
      )}
    </section>
  );
}

function RelatoriosHelp() {
  return (
    <DialogoAjuda title="Ajuda — Relatórios">
      <section>
        <h3>Montar</h3>
        <p>
          Na mesma busca, escolha projetos ou clientes, o período e ao menos um bloco. Selecionar um
          cliente inclui seus projetos; seleções combinadas não repetem valores. Sem projetos
          escolhidos, entram todos os projetos com apontamentos ou tarefas no período, de qualquer
          estado. O período considera a data dos apontamentos.
        </p>
        <p>
          Em Personalizar conteúdo dá para dar um título, escrever observações, filtrar por equipe,
          colaborador, status do projeto e status das horas (por exemplo, só horas aprovadas e
          faturadas), ordenar projetos e clientes e escolher as colunas da tabela de projetos.
        </p>
      </section>
      <section>
        <h3>Prévia e histórico</h3>
        <p>
          Ver prévia calcula o relatório com os dados atuais, mas não grava nada. Confira os
          números: se algo estiver errado, ajuste e veja a prévia de novo, ou descarte. Só Salvar no
          histórico grava uma cópia dos dados, com autor, data, filtros e versão, e libera o PDF e o
          Excel. Se você mudar alguma escolha depois da prévia, é preciso ver a prévia de novo antes
          de salvar.
        </p>
        <p>
          Um relatório salvo não muda: alterações posteriores em horas, equipes ou valores não o
          afetam. Para ver os números atuais, monte outro.
        </p>
      </section>
      <section>
        <h3>Personalizar e usar como modelo</h3>
        <p>
          Em um relatório salvo, Personalizar relatório escolhe outros projetos e blocos e mostra
          uma nova prévia. Usar como modelo copia todas as escolhas para o formulário. Nos dois
          casos, o relatório original permanece preservado e o novo só é gravado ao salvar.
        </p>
      </section>
      <section>
        <h3>Baixar</h3>
        <p>
          Baixar PDF e Baixar Excel geram o arquivo a partir da cópia gravada, com os mesmos números
          da tela, o título, as observações, os blocos e as colunas escolhidas. O nome do arquivo
          traz o número do relatório, os clientes ou projetos e o período.
        </p>
      </section>
      <section>
        <h3>Números</h3>
        <p>
          Os valores seguem as mesmas fórmulas do Dashboard Geral. Com período, equipe, colaborador
          ou só parte dos status das horas, a assertividade do orçamento fica indisponível, porque o
          orçamento integral não se compara com o custo de parte do projeto. O relatório contém
          custos internos e é de uso interno.
        </p>
      </section>
    </DialogoAjuda>
  );
}

function Tabela({ caption, colunas, linhas, vazio, limite }) {
  if (!linhas.length) return <p className="dashboard-empty">{vazio}</p>;
  const visiveis = limite ? linhas.slice(0, limite) : linhas;
  return (
    <>
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
            {visiveis.map((linha, indice) => (
              <tr key={linha.chave ?? linha.id ?? indice}>
                {colunas.map((coluna) => (
                  <td key={coluna.titulo}>{coluna.valor(linha)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visiveis.length < linhas.length && (
        <p className="dashboard-empty">
          Mostrando {visiveis.length} de {linhas.length} linhas. O PDF e o Excel trazem todas.
        </p>
      )}
    </>
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

const colunasDosProjetos = [
  { chave: "nome", titulo: "Projeto", valor: (row) => row.nome, largura: 110 },
  { chave: "cliente", titulo: "Cliente", valor: (row) => row.cliente, largura: 120 },
  { chave: "status", titulo: "Status", valor: (row) => projectStatusLabel(row.status) },
  { chave: "orcamento", titulo: "Orçamento", valor: (row) => money(row.orcamento) },
  { chave: "horas", titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
  { chave: "custoBase", titulo: "Custo base", valor: (row) => money(row.custoBase) },
  { chave: "bonificacao", titulo: "Bonificação", valor: (row) => money(row.bonificacao) },
  {
    chave: "custo",
    titulo: "Custo total",
    valor: (row) => (row.horasSemCusto > 0 ? `${money(row.custo)} (parcial)` : money(row.custo)),
  },
  {
    chave: "horasSemCusto",
    titulo: "Horas sem custo",
    valor: (row) => `${number(row.horasSemCusto ?? 0)} h`,
  },
  {
    chave: "assertividade",
    titulo: "Assertividade do orçamento",
    valor: (row) => percent(row.assertividade),
  },
  { chave: "inconsistencias", titulo: "Inconsistências", valor: (row) => row.inconsistencias },
];

const conteudoDoBloco = {
  PROJETOS: (dados, conteudo) => {
    const escolhidas = conteudo.opcoes?.colunasProjetos;
    return (
      <Tabela
        caption="Projetos do recorte"
        vazio="Nenhum projeto no recorte."
        linhas={dados.linhas}
        colunas={colunasDosProjetos.filter(
          (coluna) => !escolhidas || coluna.chave === "nome" || escolhidas.includes(coluna.chave),
        )}
      />
    );
  },
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
  EQUIPES: (dados) => (
    <Tabela
      caption="Equipes (departamentos) do recorte"
      vazio="Nenhuma equipe com horas no recorte."
      linhas={dados.linhas.map((row) => ({ ...row, chave: row.nome }))}
      colunas={[
        { titulo: "Equipe", valor: (row) => row.nome, largura: 160 },
        { titulo: "Colaboradores", valor: (row) => row.colaboradores },
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
        linhas={TODOS_STATUS.map((status) => ({
          chave: status,
          status,
          horas: dados.porStatus[status] ?? 0,
        }))}
        colunas={[
          { titulo: "Status", valor: (row) => ROTULO_STATUS_HORAS[row.status] ?? row.status },
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
  EVOLUCAO: (dados) => (
    <Tabela
      caption="Horas e custo por mês"
      vazio="Sem horas no recorte."
      linhas={dados.linhas.map((row) => ({ ...row, chave: row.mes }))}
      colunas={[
        { titulo: "Mês", valor: (row) => mesBr(row.mes) },
        { titulo: "Apontamentos", valor: (row) => row.apontamentos },
        { titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
        { titulo: "Custo base", valor: (row) => money(row.custoBase) },
        { titulo: "Bonificação", valor: (row) => money(row.bonificacao) },
        { titulo: "Custo total", valor: (row) => money(row.custo) },
      ]}
    />
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
        limite={LIMITE_LINHAS_PREVIA}
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
  APONTAMENTOS: (dados) => (
    <Tabela
      caption={`${dados.linhas.length} apontamento(s) no recorte`}
      vazio="Sem apontamentos no recorte."
      linhas={dados.linhas}
      limite={LIMITE_LINHAS_PREVIA}
      colunas={[
        { titulo: "Data", valor: (row) => dataBr(row.data) },
        { titulo: "Projeto", valor: (row) => row.projeto, largura: 120 },
        { titulo: "Tarefa", valor: (row) => row.tarefa || "Sem tarefa", largura: 120 },
        { titulo: "Colaborador", valor: (row) => row.colaborador, largura: 120 },
        { titulo: "Horas", valor: (row) => `${number(row.horas)} h` },
        { titulo: "Status", valor: (row) => ROTULO_STATUS_HORAS[row.status] ?? row.status },
        {
          titulo: "Custo",
          valor: (row) =>
            row.semCusto ? `${money(row.custo)} (sem valor/hora)` : money(row.custo),
        },
        { titulo: "Descrição", valor: (row) => row.descricao || "—", largura: 200 },
      ]}
    />
  ),
};

// Etiquetas dos filtros extras e das opções, só quando foram usados.
function etiquetasExtras(conteudo) {
  const filtros = conteudo.filtros ?? {};
  const opcoes = conteudo.opcoes ?? {};
  return [
    filtros.equipe && ["Equipe", filtros.equipe],
    filtros.colaboradorId && [
      "Colaborador",
      conteudo.nomesFiltros?.colaborador ?? `nº ${filtros.colaboradorId}`,
    ],
    filtros.statusProjeto && ["Status do projeto", projectStatusLabel(filtros.statusProjeto)],
    filtros.statusApontamentos?.length && [
      "Horas",
      filtros.statusApontamentos.map((status) => ROTULO_STATUS_HORAS[status]).join(", "),
    ],
    opcoes.ordenacao &&
      opcoes.ordenacao !== "NOME" && [
        "Ordem",
        ORDENACOES.find((item) => item.value === opcoes.ordenacao)?.label ?? opcoes.ordenacao,
      ],
  ].filter(Boolean);
}

// [TELA] Prévia de um relatório: ainda não gravado (previa) ou lido da cópia gravada.
export function RelatorioPrevia({ relatorio }) {
  const { conteudo } = relatorio;
  const titulo = conteudo.opcoes?.titulo;
  const escolhidos = new Set(conteudo.filtros.projetoIds ?? []);
  const nomesEscolhidos = conteudo.projetos
    .filter((row) => escolhidos.has(row.id))
    .map((row) => row.nome);
  return (
    <section
      className={`dashboard-detail report-preview${relatorio.previa ? " report-preview--draft" : ""}`}
      aria-labelledby="relatorio-titulo"
    >
      <header className="report-preview-header">
        <FileChartColumn size={22} aria-hidden="true" />
        <div>
          <h2 id="relatorio-titulo">
            {relatorio.previa ? "Prévia do relatório" : `Relatório nº ${relatorio.id}`}
            {titulo ? ` — ${titulo}` : ""}
          </h2>
          <p>
            {relatorio.previa
              ? `Calculada em ${dataHora(relatorio.criadoEm)} com os dados atuais. Ainda não foi salva no histórico.`
              : `Gerado em ${dataHora(relatorio.criadoEm)} por ${relatorio.autor ?? "usuário removido"}. Cópia dos dados nesse momento (versão ${relatorio.versao}).`}
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
        {etiquetasExtras(conteudo).map(([rotulo, valor]) => (
          <li key={rotulo}>
            <span>{rotulo}:</span> {valor}
          </li>
        ))}
      </ul>
      {conteudo.opcoes?.observacoes && (
        <p className="report-notes">
          <strong>Observações:</strong> {conteudo.opcoes.observacoes}
        </p>
      )}
      {conteudo.blocos.map((key) => {
        const bloco = BLOCOS.find((row) => row.key === key);
        return (
          <section className="report-block-section" key={key} aria-labelledby={`bloco-${key}`}>
            <h3 id={`bloco-${key}`}>{bloco?.label ?? key}</h3>
            {conteudoDoBloco[key]?.(conteudo.dados[key], conteudo)}
          </section>
        );
      })}
    </section>
  );
}
