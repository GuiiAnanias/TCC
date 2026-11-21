/**
 * [TELA] Premiação (/premiacao): avaliações mensais Dev e PO/SM (rascunho, conclusão, reavaliação)
 * e a publicação das regras e faixas.
 */

import React, { useEffect, useRef, useState } from "react";
import { Plus, Save, Check, X } from "lucide-react";
import { api } from "../api/conexao.js";
import { DialogoAjuda } from "../components/comum/DialogoAjuda.jsx";
import { PaginacaoTabela, usePaginacao } from "../components/comum/PaginacaoTabela.jsx";
import { AcoesPagina } from "../components/comum/AcoesPagina.jsx";
import { SelecaoComBusca } from "../components/comum/SelecaoComBusca.jsx";
import { projectStatusLabel } from "../config/opcoesProjeto.js";
import {
  IndicatorTasksTable,
  number,
  date,
} from "../components/dashboard/DashboardOperacional.jsx";

const categories = { DEV: "Dev", PO_SM: "PO/SM" };
const failure = (error) =>
  error.response?.data?.errors?.[0]?.message ||
  error.response?.data?.message ||
  "Não foi possível concluir a operação.";
const emptyData = () => ({
  projetoIds: [],
  sprintIds: [],
  respostas: [],
  percentualBase: null,
  percentualInformado: null,
  justificativaPercentual: "",
  observacoes: "",
});
import { currentBusinessMonth as month } from "../utils/datasEmpresa.js";
const fieldNumber = (value) => (value === "" ? null : Number(value));
const percent = (value) =>
  value == null
    ? "Indisponível"
    : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

function AwardsHelp() {
  return (
    <DialogoAjuda title="Ajuda — Premiação">
      <section>
        <h3>Regras e categorias</h3>
        <p>
          Premiação é um módulo adicional de demonstração. Dev e PO/SM têm critérios separados,
          oferecidos como modelo de exemplo do sistema, montado a partir de uma planilha de
          avaliação usada no levantamento. Não representam a política de uma empresa real. Os
          modelos começam com 10 pontos. Cada critério marcado como ocorrência desconta sua dedução
          uma única vez na avaliação mensal, independentemente da quantidade de tarefas. Não
          aplicável não desconta e exige justificativa.
        </p>
        <p>
          Ao publicar uma versão, a empresa ajusta a pontuação inicial, as deduções e as faixas.
          Abaixo de cada critério aparece onde conferi-lo antes de marcar a resposta.
        </p>
        <p>
          Publicar cria uma versão imutável das regras. Alterações usam outra versão, com nome que
          identifique a revisão. As avaliações existentes conservam suas regras e deduções.
        </p>
      </section>
      <section>
        <h3>Nota e percentual</h3>
        <p>
          Nota final = pontuação-base − deduções dos critérios com ocorrência. Sem conferência de
          todos os critérios, a nota é provisória. A nota pode ser negativa: não há piso presumido.
        </p>
        <p>
          As faixas de conversão da nota começam vazias: o sistema não presume percentuais.
          Configure limites inclusivos, sem sobreposição; notas não cobertas ficam sem percentual
          automático. Os percentuais e as faixas são definidos pela empresa.
        </p>
        <p>
          Informe o percentual-base de premiação desta pessoa e competência, com a origem nas
          observações. Exemplo apenas de cálculo: base 5% × elegibilidade 80% = premiação final 4%.
          Não é um valor em reais. Se necessário, informe a elegibilidade manualmente, com
          justificativa e origem; ela prevalece sobre as faixas. Campo vazio é diferente de zero.
        </p>
        <p>
          Concluir preserva a nota conferida mesmo se faltar configuração do percentual. Nesse caso
          o percentual continua indisponível. Esta tela não comprova pagamento e não altera o bônus
          por papel nem os custos dos projetos.
        </p>
      </section>
      <section>
        <h3>Conferência e contexto</h3>
        <p>
          Escolha explicitamente pessoa, competência, categoria e projetos. Sprints são opcionais:
          nenhuma selecionada inclui todas as sprints e tarefas sem sprint dos projetos. Selecionar
          sprints restringe o contexto a elas. Em PO/SM, selecione os projetos sob gestão; não se
          presume que todas as tarefas sejam de execução dessa pessoa.
        </p>
        <p>
          Salvar o rascunho consulta os dados atuais e preserva uma cópia da base de conferência com
          data, projetos, sprints, papéis e tarefas. As respostas continuam manuais; os indicadores
          não comprovam autoria de erro, atraso, notificação ou ausência. Estimativas de Dev usam o
          contexto integral das tarefas compartilhadas, sem dividir a estimativa entre responsáveis.
        </p>
        <p>
          Os indicadores seguem o dashboard: tarefas concluídas comparáveis exigem estimativa e
          todas as horas dentro do mês; tarefas sem datas/horas no mês podem ficar fora. Correções
          por horas não equivalem à quantidade de tarefas de correção ou ao tempo da tarefa
          original. Confira o contexto antes de marcar cada critério.
        </p>
        <p>
          Após salvar, confira a base e conclua. Avaliação concluída é imutável. Reavaliar cria
          outra versão da mesma pessoa, competência e categoria, mantém o histórico e exige nova
          conferência. A versão anterior permanece visível no histórico. Duas sessões não podem
          sobrescrever silenciosamente o mesmo rascunho.
        </p>
      </section>
    </DialogoAjuda>
  );
}

// [TELA] Componente da tela.
export function PremiacaoPage() {
  const [models, setModels] = useState({});
  const [rules, setRules] = useState([]);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState("avaliacoes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [filters, setFilters] = useState({
    busca: "",
    competencia: "",
    categoria: "",
    status: "",
    historico: false,
  });
  const [choiceFilters, setChoiceFilters] = useState({
    buscaProjeto: "",
    statusProjeto: "",
    buscaSprint: "",
    statusSprint: "",
  });
  const sequence = useRef(0);
  const region = useRef(null);
  // [REQUISICAO] Modelos, regras, colaboradores, projetos, sprints e avaliações.
  async function load() {
    const seq = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        api.get("/premiacoes/modelos"),
        api.get("/premiacoes/regras"),
        api.get("/colaboradores"),
        api.get("/projetos"),
        api.get("/sprints"),
        api.get("/premiacoes"),
      ]);
      if (seq !== sequence.current) return;
      setModels(responses[0].data);
      setRules(responses[1].data);
      setPeople(responses[2].data);
      setProjects(responses[3].data);
      setSprints(responses[4].data);
      setRows(responses[5].data);
    } catch (err) {
      if (seq === sequence.current) setError(failure(err));
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      sequence.current++;
    };
  }, []);
  const selectedRule = rules.find((row) => row.id === Number(form?.regraId));
  const readOnly = editor?.status === "CONCLUIDA";
  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
  }
  function changeData(key, value) {
    setForm((current) => ({ ...current, dados: { ...current.dados, [key]: value } }));
    setDirty(true);
    setMessage("");
  }
  // [TELA] Nova avaliação (ou reavaliação a partir de uma concluída).
  function newEvaluation(previous = null) {
    const category = previous?.categoria || "DEV";
    const rule = rules.find((row) => row.categoria === category);
    setEditor(null);
    setForm({
      colaboradorId: previous?.colaboradorId || "",
      competencia: previous?.competencia || month(),
      regraId: rule?.id || "",
      categoria: category,
      anteriorId: previous?.id || null,
      dados: previous
        ? {
            ...emptyData(),
            projetoIds: previous.conteudo.dados.projetoIds,
            sprintIds: previous.conteudo.dados.sprintIds,
            percentualBase: previous.conteudo.dados.percentualBase,
          }
        : emptyData(),
    });
    setDirty(true);
    setError("");
    setMessage("");
    setChoiceFilters({ buscaProjeto: "", statusProjeto: "", buscaSprint: "", statusSprint: "" });
    requestAnimationFrame(() =>
      region.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  async function openEvaluation(id) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.get(`/premiacoes/${id}`);
      setEditor(data);
      setForm({
        colaboradorId: data.colaboradorId,
        competencia: data.competencia,
        categoria: data.categoria,
        regraId: data.regraId,
        anteriorId: data.anteriorId,
        dados: data.conteudo.dados,
      });
      setDirty(false);
      setChoiceFilters({ buscaProjeto: "", statusProjeto: "", buscaSprint: "", statusSprint: "" });
      requestAnimationFrame(() =>
        region.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  function changeCategory(category) {
    setForm((current) => ({
      ...current,
      categoria: category,
      regraId: rules.find((row) => row.categoria === category)?.id || "",
      dados: { ...current.dados, respostas: [] },
    }));
    setDirty(true);
  }
  function toggleProject(id, checked) {
    const ids = checked
      ? [...form.dados.projetoIds, id]
      : form.dados.projetoIds.filter((value) => value !== id);
    setForm((current) => ({
      ...current,
      dados: {
        ...current.dados,
        projetoIds: ids,
        sprintIds: current.dados.sprintIds.filter((value) =>
          sprints.some((sprint) => sprint.id === value && ids.includes(sprint.projetoId)),
        ),
      },
    }));
    setDirty(true);
  }
  // [ESTADO] Resposta de um critério (A conferir, Há ocorrência, Sem ocorrência, Não aplicável) e a
  // evidência.
  function answer(criterion, key, value) {
    const existing = form.dados.respostas.find((row) => row.chave === criterion.chave) || {
      chave: criterion.chave,
      situacao: "PENDENTE",
      evidencia: "",
    };
    changeData("respostas", [
      ...form.dados.respostas.filter((row) => row.chave !== criterion.chave),
      { ...existing, [key]: value },
    ]);
  }
  // [REQUISICAO] Salva o rascunho: POST (nova) ou PUT com a revisão (evita sobrescrever outra
  // sessão).
  async function save(event) {
    event.preventDefault();
    if (!editor && !form.colaboradorId) {
      setError("Selecione um colaborador para a avaliação.");
      document.getElementById("premiacao-colaborador")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = editor
        ? await api.put(`/premiacoes/${editor.id}`, { revisao: editor.revisao, dados: form.dados })
        : await api.post("/premiacoes", {
            colaboradorId: Number(form.colaboradorId),
            competencia: form.competencia,
            regraId: Number(form.regraId),
            anteriorId: form.anteriorId,
            dados: form.dados,
          });
      setEditor(data);
      setForm((current) => ({ ...current, dados: data.conteudo.dados }));
      setDirty(false);
      setRows((await api.get("/premiacoes")).data);
      setMessage("Rascunho salvo e base de conferência atualizada.");
      requestAnimationFrame(() =>
        region.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  // [REQUISICAO] Conclui a avaliação (POST /premiacoes/:id/concluir); depois disso ela não muda.
  async function closeEvaluation() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post(`/premiacoes/${editor.id}/concluir`, {
        revisao: editor.revisao,
      });
      setEditor(data);
      setRows((await api.get("/premiacoes")).data);
      setMessage("Avaliação concluída. Nota, respostas e base foram preservadas.");
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  const visible = rows.filter(
    (row) =>
      (filters.historico || !row.proxima) &&
      (!filters.competencia || row.competencia === filters.competencia) &&
      (!filters.categoria || row.categoria === filters.categoria) &&
      (!filters.status || row.status === filters.status) &&
      row.colaborador.nome
        .toLocaleLowerCase("pt-BR")
        .includes(filters.busca.toLocaleLowerCase("pt-BR")),
  );
  const paginacaoAvaliacoes = usePaginacao(visible);
  const projetosFiltradosEscolhas = projects.filter((row) => {
    if (!form) return false;
    const selecionado = form.dados.projetoIds.includes(row.id);
    if (choiceFilters.statusProjeto === "SELECIONADOS" && !selecionado) return false;
    if (
      choiceFilters.statusProjeto &&
      choiceFilters.statusProjeto !== "SELECIONADOS" &&
      row.status !== choiceFilters.statusProjeto
    )
      return false;
    const termo = choiceFilters.buscaProjeto.trim().toLocaleLowerCase("pt-BR");
    if (termo && !row.nome.toLocaleLowerCase("pt-BR").includes(termo)) return false;
    return true;
  });
  const paginacaoProjetosAvaliados = usePaginacao(projetosFiltradosEscolhas);
  const sprintsDosProjetosEscolhidos = sprints.filter(
    (row) => form && form.dados.projetoIds.includes(row.projetoId),
  );
  const sprintsFiltradasEscolhas = sprintsDosProjetosEscolhidos.filter((row) => {
    const selecionada = form.dados.sprintIds.includes(row.id);
    if (choiceFilters.statusSprint === "SELECIONADOS" && !selecionada) return false;
    if (
      choiceFilters.statusSprint &&
      choiceFilters.statusSprint !== "SELECIONADOS" &&
      row.statusRegistro !== choiceFilters.statusSprint
    )
      return false;
    const termoSprint = choiceFilters.buscaSprint.trim().toLocaleLowerCase("pt-BR");
    if (termoSprint) {
      const texto = `${row.projeto?.nome || ""} ${row.nome}`.toLocaleLowerCase("pt-BR");
      if (!texto.includes(termoSprint)) return false;
    }
    return true;
  });
  const paginacaoSprintsAvaliadas = usePaginacao(sprintsFiltradasEscolhas);
  const ruleDefinition = editor?.conteudo.regra || selectedRule?.definicao;
  return (
    <section className="content-panel awards-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Avaliação de desempenho</span>
          <div className="dashboard-title-row">
            <h1>Premiação</h1>
            <AwardsHelp />
          </div>
        </div>
        <AcoesPagina onRefresh={load} loading={loading || busy} />
      </header>
      <div className="feedback-row">
        {error && (
          <div className="feedback error" role="alert">
            <X size={18} />
            {error}
          </div>
        )}
        {message && (
          <div className="feedback success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
      </div>
      <div className="tasks-tabs" role="group" aria-label="Área de premiação">
        <button
          className={tab === "avaliacoes" ? "primary-button" : "secondary-button"}
          onClick={() => setTab("avaliacoes")}
          disabled={busy}
        >
          Avaliações
        </button>
        <button
          className={tab === "regras" ? "primary-button" : "secondary-button"}
          onClick={() => setTab("regras")}
          disabled={busy}
        >
          Regras e faixas
        </button>
      </div>
      {tab === "regras" ? (
        <AwardRules
          models={models}
          rules={rules}
          onSaved={async (rule) => {
            setRules((current) => [rule, ...current]);
            setMessage(
              "Nova versão das regras publicada. Avaliações anteriores foram preservadas.",
            );
          }}
        />
      ) : (
        <>
          <div className="actions-row">
            <button
              className="primary-button"
              disabled={busy || loading || !rules.length}
              onClick={() => newEvaluation()}
            >
              <Plus size={18} />
              Nova avaliação
            </button>
          </div>
          {!loading && !rules.length && (
            <div className="feedback warning">
              Publique uma versão em Regras e faixas para começar. As faixas de conversão podem
              ficar vazias.
            </div>
          )}
          {form && (
            <div ref={region} className="form-panel award-editor">
              <div className="award-section-heading">
                <h2>
                  {readOnly
                    ? "Avaliação concluída"
                    : editor
                      ? "Editar rascunho"
                      : form.anteriorId
                        ? "Nova reavaliação"
                        : "Nova avaliação"}
                </h2>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    setForm(null);
                    setEditor(null);
                  }}
                >
                  Fechar avaliação
                </button>
              </div>
              {editor && <AwardResult evaluation={editor} />}
              <details className="award-form-details" open={!readOnly}>
                <summary>
                  {readOnly
                    ? "Consultar critérios, contexto e percentuais preservados"
                    : "Preencher avaliação"}
                </summary>
                <form onSubmit={save}>
                  <fieldset disabled={busy || loading || readOnly} className="tasks-form-fields">
                    <div className="form-grid">
                      <div className="field">
                        <span>Colaborador</span>
                        <SelecaoComBusca
                          id="premiacao-colaborador"
                          name="colaboradorId"
                          options={people.map((row) => ({
                            value: String(row.id),
                            label: `${row.nomeCompleto}${row.status === "INATIVO" ? " (inativo)" : ""}`,
                          }))}
                          value={String(form.colaboradorId || "")}
                          placeholder="Selecione"
                          required
                          disabled={Boolean(editor || form.anteriorId)}
                          onChange={(e) => change("colaboradorId", e.target.value)}
                        />
                      </div>
                      <label className="field">
                        <span>Competência</span>
                        <input
                          required
                          type="month"
                          min="2000-01"
                          max="2099-12"
                          disabled={Boolean(editor || form.anteriorId)}
                          value={form.competencia}
                          onChange={(e) => change("competencia", e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Categoria</span>
                        <select
                          disabled={Boolean(editor || form.anteriorId)}
                          value={form.categoria}
                          onChange={(e) => changeCategory(e.target.value)}
                        >
                          {Object.entries(categories).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Versão das regras</span>
                        <select
                          required
                          disabled={Boolean(editor)}
                          value={form.regraId}
                          onChange={(e) => {
                            change("regraId", e.target.value);
                            changeData("respostas", []);
                          }}
                        >
                          <option value="">Selecione</option>
                          {rules
                            .filter((row) => row.categoria === form.categoria)
                            .map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.nome} · {date(row.createdAt)}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="award-choice-section">
                      <div className="award-choice-header">
                        <h3>Projetos avaliados</h3>
                        <span className="award-choice-count">
                          {form.dados.projetoIds.length} selecionado(s) de {projects.length}
                        </span>
                      </div>
                      <div className="award-choice-toolbar">
                        <input
                          type="search"
                          aria-label="Filtrar projetos avaliados"
                          placeholder="Filtrar projetos por nome..."
                          value={choiceFilters.buscaProjeto}
                          onChange={(e) =>
                            setChoiceFilters((current) => ({
                              ...current,
                              buscaProjeto: e.target.value,
                            }))
                          }
                        />
                        <select
                          aria-label="Filtrar status dos projetos avaliados"
                          value={choiceFilters.statusProjeto}
                          onChange={(e) =>
                            setChoiceFilters((current) => ({
                              ...current,
                              statusProjeto: e.target.value,
                            }))
                          }
                        >
                          <option value="">Todos os status</option>
                          <option value="SELECIONADOS">Apenas selecionados</option>
                          <option value="ATIVO">Ativo</option>
                          <option value="PAUSADO">Pausado</option>
                          <option value="ENCERRADO">Encerrado</option>
                          <option value="CANCELADO">Cancelado</option>
                        </select>
                      </div>
                      <div className="award-choices">
                        {!projetosFiltradosEscolhas.length ? (
                          <p className="award-choices-empty">
                            Nenhum projeto encontrado para este filtro.
                          </p>
                        ) : (
                          paginacaoProjetosAvaliados.itensPaginados.map((row) => (
                            <label
                              key={row.id}
                              className="tasks-check"
                              title={`${row.nome} (${projectStatusLabel(row.status)})`}
                            >
                              <input
                                type="checkbox"
                                checked={form.dados.projetoIds.includes(row.id)}
                                onChange={(e) => toggleProject(row.id, e.target.checked)}
                              />
                              <span>
                                {row.nome}
                                {` (${projectStatusLabel(row.status)})`}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      <PaginacaoTabela
                        pagina={paginacaoProjetosAvaliados.pagina}
                        totalPaginas={paginacaoProjetosAvaliados.totalPaginas}
                        totalItens={paginacaoProjetosAvaliados.totalItens}
                        inicio={paginacaoProjetosAvaliados.inicio}
                        fim={paginacaoProjetosAvaliados.fim}
                        onPageChange={paginacaoProjetosAvaliados.setPagina}
                        rotulo="Páginas de projetos avaliados"
                      />
                    </div>
                    <div className="award-choice-section">
                      <div className="award-choice-header">
                        <h3>Sprints do recorte (opcional)</h3>
                        <span className="award-choice-count">
                          {form.dados.sprintIds.length} selecionada(s) de{" "}
                          {sprintsDosProjetosEscolhidos.length}
                        </span>
                      </div>
                      <div className="award-choice-toolbar">
                        <input
                          type="search"
                          aria-label="Filtrar sprints do recorte"
                          placeholder="Filtrar sprints por nome ou projeto..."
                          disabled={!sprintsDosProjetosEscolhidos.length}
                          value={choiceFilters.buscaSprint}
                          onChange={(e) =>
                            setChoiceFilters((current) => ({
                              ...current,
                              buscaSprint: e.target.value,
                            }))
                          }
                        />
                        <select
                          aria-label="Filtrar status das sprints do recorte"
                          disabled={!sprintsDosProjetosEscolhidos.length}
                          value={choiceFilters.statusSprint}
                          onChange={(e) =>
                            setChoiceFilters((current) => ({
                              ...current,
                              statusSprint: e.target.value,
                            }))
                          }
                        >
                          <option value="">Todas as sprints</option>
                          <option value="SELECIONADOS">Apenas selecionadas</option>
                          <option value="ATIVO">Ativas</option>
                          <option value="INATIVO">Arquivadas</option>
                        </select>
                      </div>
                      <div className="award-choices">
                        {!form.dados.projetoIds.length ? (
                          <p className="award-choices-empty">
                            Selecione ao menos um projeto acima para listar as sprints.
                          </p>
                        ) : !sprintsFiltradasEscolhas.length ? (
                          <p className="award-choices-empty">
                            Nenhuma sprint encontrada para este filtro.
                          </p>
                        ) : (
                          paginacaoSprintsAvaliadas.itensPaginados.map((row) => (
                            <label
                              key={row.id}
                              className="tasks-check"
                              title={`${row.projeto?.nome} · ${row.nome}${row.statusRegistro === "INATIVO" ? " (arquivada)" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={form.dados.sprintIds.includes(row.id)}
                                onChange={(e) =>
                                  changeData(
                                    "sprintIds",
                                    e.target.checked
                                      ? [...form.dados.sprintIds, row.id]
                                      : form.dados.sprintIds.filter((id) => id !== row.id),
                                  )
                                }
                              />
                              <span>
                                {row.projeto?.nome} · {row.nome}
                                {row.statusRegistro === "INATIVO" ? " (arquivada)" : ""}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      <PaginacaoTabela
                        pagina={paginacaoSprintsAvaliadas.pagina}
                        totalPaginas={paginacaoSprintsAvaliadas.totalPaginas}
                        totalItens={paginacaoSprintsAvaliadas.totalItens}
                        inicio={paginacaoSprintsAvaliadas.inicio}
                        fim={paginacaoSprintsAvaliadas.fim}
                        onPageChange={paginacaoSprintsAvaliadas.setPagina}
                        rotulo="Páginas de sprints do recorte"
                      />
                    </div>
                    {ruleDefinition && (
                      <>
                        <h3>Conferência dos critérios</h3>
                        <div className="award-criteria">
                          {ruleDefinition.criterios.map((criterion) => {
                            const response = form.dados.respostas.find(
                              (row) => row.chave === criterion.chave,
                            );
                            return (
                              <div className="award-criterion" key={criterion.chave}>
                                <div>
                                  <strong>{criterion.titulo}</strong>
                                  <span className="award-deduction">
                                    Dedução: {number(criterion.deducao)} ponto(s)
                                  </span>
                                </div>
                                <label className="field">
                                  <span>Conferência</span>
                                  <select
                                    aria-label={`Conferência — ${criterion.titulo}`}
                                    value={response?.situacao || "PENDENTE"}
                                    onChange={(e) => answer(criterion, "situacao", e.target.value)}
                                  >
                                    <option value="PENDENTE">A conferir</option>
                                    <option value="SIM">Há ocorrência</option>
                                    <option value="NAO">Sem ocorrência</option>
                                    <option value="NA">Não aplicável</option>
                                  </select>
                                </label>
                                <label className="field">
                                  <span>Evidência / justificativa</span>
                                  <textarea
                                    aria-label={`Evidência / justificativa — ${criterion.titulo}`}
                                    rows={2}
                                    maxLength={5000}
                                    required={["SIM", "NA"].includes(response?.situacao)}
                                    minLength={
                                      ["SIM", "NA"].includes(response?.situacao) ? 3 : undefined
                                    }
                                    value={response?.evidencia || ""}
                                    onChange={(e) => answer(criterion, "evidencia", e.target.value)}
                                  />
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <h3>Percentual de premiação</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Percentual-base (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.0001"
                          placeholder="Não informado"
                          value={form.dados.percentualBase ?? ""}
                          onChange={(e) =>
                            changeData("percentualBase", fieldNumber(e.target.value))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Elegibilidade informada (%) — opcional</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.0001"
                          placeholder="Usar faixas configuradas"
                          value={form.dados.percentualInformado ?? ""}
                          onChange={(e) =>
                            changeData("percentualInformado", fieldNumber(e.target.value))
                          }
                        />
                      </label>
                      <label className="field field-wide">
                        <span>Origem e justificativa da elegibilidade informada</span>
                        <textarea
                          rows={2}
                          maxLength={5000}
                          required={form.dados.percentualInformado != null}
                          minLength={form.dados.percentualInformado != null ? 3 : undefined}
                          value={form.dados.justificativaPercentual}
                          onChange={(e) => changeData("justificativaPercentual", e.target.value)}
                        />
                      </label>
                      <label className="field field-wide">
                        <span>Observações e origem do percentual-base</span>
                        <textarea
                          rows={3}
                          maxLength={5000}
                          value={form.dados.observacoes}
                          onChange={(e) => changeData("observacoes", e.target.value)}
                        />
                      </label>
                    </div>
                    {!readOnly && (
                      <div className="actions-row">
                        <button className="primary-button" type="submit">
                          <Save size={18} />
                          Salvar rascunho e atualizar base
                        </button>
                      </div>
                    )}
                  </fieldset>
                </form>
              </details>
              {dirty && (
                <div className="feedback warning" role="status">
                  Há alterações não salvas. Salve para atualizar a nota e a base de conferência.
                </div>
              )}
              {editor && !readOnly && (
                <div className="actions-row">
                  <button
                    className="primary-button"
                    disabled={busy || dirty || editor.conteudo.resultado.pendentes > 0}
                    onClick={closeEvaluation}
                  >
                    <Check size={18} />
                    Concluir avaliação
                  </button>
                </div>
              )}
              {readOnly && !editor.proxima && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => newEvaluation(editor)}
                >
                  Reavaliar esta competência
                </button>
              )}
              {readOnly && editor.proxima && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => openEvaluation(editor.proxima.id)}
                >
                  Abrir reavaliação · versão {editor.proxima.versao}
                </button>
              )}
            </div>
          )}
          <h2>Histórico de avaliações</h2>
          <div className="table-toolbar award-filters">
            <input
              aria-label="Buscar colaborador"
              placeholder="Buscar colaborador"
              value={filters.busca}
              onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
            />
            <input
              aria-label="Filtrar competência"
              type="month"
              value={filters.competencia}
              onChange={(e) => setFilters({ ...filters, competencia: e.target.value })}
            />
            <select
              aria-label="Filtrar categoria"
              value={filters.categoria}
              onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
            >
              <option value="">Todas as categorias</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar situação"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todas as situações</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="CONCLUIDA">Concluída</option>
            </select>
            <label className="tasks-check">
              <input
                type="checkbox"
                checked={filters.historico}
                onChange={(e) => setFilters({ ...filters, historico: e.target.checked })}
              />
              Incluir versões anteriores
            </label>
          </div>
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Colaborador / competência</th>
                  <th>Categoria / regras</th>
                  <th>Situação</th>
                  <th>Nota</th>
                  <th>Premiação final</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {paginacaoAvaliacoes.itensPaginados.map((row) => (
                  <tr key={row.id}>
                    <td title={`${row.colaborador.nome} · ${row.competencia}`}>
                      {row.colaborador.nome}
                      <small className="dashboard-detail-note">
                        {row.competencia} · versão {row.versao}
                      </small>
                    </td>
                    <td title={`${categories[row.categoria]} — ${row.regraNome}`}>
                      {categories[row.categoria]}
                      <small className="dashboard-detail-note">{row.regraNome}</small>
                    </td>
                    <td>
                      {row.status === "RASCUNHO" ? "Rascunho" : "Concluída"}
                      {row.proxima && (
                        <small className="dashboard-detail-note">Possui reavaliação</small>
                      )}
                    </td>
                    <td>
                      {row.resultado.notaFinal == null
                        ? "A conferir"
                        : number(row.resultado.notaFinal)}
                    </td>
                    <td>{percent(row.resultado.percentualFinal)}</td>
                    <td>
                      <button
                        className="secondary-button"
                        disabled={busy || loading}
                        onClick={() => openEvaluation(row.id)}
                      >
                        Abrir avaliação
                      </button>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td className="empty-cell" colSpan={6}>
                      {loading ? "Carregando…" : "Nenhuma avaliação neste recorte."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginacaoTabela
            pagina={paginacaoAvaliacoes.pagina}
            totalPaginas={paginacaoAvaliacoes.totalPaginas}
            totalItens={paginacaoAvaliacoes.totalItens}
            inicio={paginacaoAvaliacoes.inicio}
            fim={paginacaoAvaliacoes.fim}
            onPageChange={paginacaoAvaliacoes.setPagina}
            rotulo="Páginas do histórico de avaliações"
          />
        </>
      )}
    </section>
  );
}

// [TELA] Nota, elegibilidade e percentual final da avaliação.
function AwardResult({ evaluation }) {
  const {
    conteudo: { resultado: result, base },
    status,
  } = evaluation;
  return (
    <section className="award-result">
      <h3>
        {evaluation.conteudo.colaborador.nome} · {evaluation.competencia} ·{" "}
        {categories[evaluation.categoria]}
      </h3>
      <p>{status === "CONCLUIDA" ? "Resultado preservado" : "Resultado do rascunho salvo"}</p>
      <div className="award-results-grid">
        {[
          ["Nota inicial", number(result.pontuacaoBase)],
          ["Deduções", number(result.deducoes)],
          [
            result.notaFinal == null ? "Nota provisória" : "Nota final",
            number(result.notaFinal ?? result.notaProvisoria),
          ],
          ["Percentual-base", percent(result.percentualBase)],
          ["Elegibilidade", percent(result.percentualElegivel)],
          ["Premiação final (%)", percent(result.percentualFinal)],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {result.motivos.map((reason) => (
        <p key={reason} className="feedback warning">
          {reason}
        </p>
      ))}
      <p>
        Elegibilidade:{" "}
        {result.origemPercentual === "INFORMADO"
          ? "informada com justificativa"
          : "por faixa de nota"}
        .
      </p>
      <p>
        Versão {evaluation.versao} · criada por {evaluation.criadoPor.nomeUsuario} em{" "}
        {date(evaluation.createdAt)}
        {evaluation.concluidoEm
          ? ` · concluída por ${evaluation.concluidoPor.nomeUsuario} em ${date(evaluation.concluidoEm)}`
          : ` · última alteração por ${evaluation.conteudo.atualizadoPor}`}
      </p>
      <details className="award-evidence">
        <summary>Base de conferência salva · {date(base.consultadaEm)}</summary>
        <p>{base.escopo}</p>
        <p>
          {base.projetos
            .map(
              (row) =>
                `${row.nome}${row.papeis.length ? ` (${row.papeis.map((role) => role.papel).join(", ")})` : " (sem papel registrado no mês)"}`,
            )
            .join("; ")}
        </p>
        <div className="award-results-grid">
          <div>
            <span>Assertividade das tarefas (contexto)</span>
            <strong>
              {percent(
                base.indicadores.assertividadeEstimativas ??
                  base.indicadores.assertividadeTarefasContexto,
              )}
            </strong>
          </div>
          <div>
            <span>Concluídas sem horas</span>
            <strong>
              {base.indicadores.tarefasSemHoras} / {base.indicadores.tarefasConcluidas}
            </strong>
          </div>
          <div>
            <span>Sem estimativa</span>
            <strong>
              {base.indicadores.tarefasSemEstimativa} / {base.indicadores.tarefas}
            </strong>
          </div>
        </div>
        <IndicatorTasksTable tasks={base.tarefas} individual={evaluation.categoria === "DEV"} />
      </details>
    </section>
  );
}

// [TELA] Publicação de uma versão das regras (critérios, deduções e faixas).
function AwardRules({ models, rules, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paginacaoRegras = usePaginacao(rules);
  function start(source) {
    setDraft(JSON.parse(JSON.stringify(source)));
    setError("");
  }
  async function publish(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/premiacoes/regras", draft);
      await onSaved(data);
      setDraft(null);
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Regras e faixas</h2>
      <div className="actions-row">
        {Object.entries(models).map(([key, model]) => (
          <button
            key={key}
            className="secondary-button"
            disabled={busy}
            onClick={() => start(model)}
          >
            <Plus size={18} />
            Nova versão de {categories[key]}
          </button>
        ))}
      </div>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <form className="form-panel" onSubmit={publish}>
          <h3>Publicar regras de {categories[draft.categoria]}</h3>
          <fieldset disabled={busy} className="tasks-form-fields">
            <div className="form-grid">
              <label className="field">
                <span>Nome da versão</span>
                <input
                  required
                  minLength={3}
                  maxLength={150}
                  value={draft.nome}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Pontuação inicial</span>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={draft.pontuacaoBase}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      pontuacaoBase: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="award-rule-criteria">
              {draft.criterios.map((criterion, i) => (
                <label className="field" key={criterion.chave}>
                  <span>{criterion.titulo}</span>
                  <input
                    aria-label={`Dedução — ${criterion.titulo}`}
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={criterion.deducao}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        criterios: draft.criterios.map((row, index) =>
                          index === i
                            ? {
                                ...row,
                                deducao: e.target.value === "" ? "" : Number(e.target.value),
                              }
                            : row,
                        ),
                      })
                    }
                  />
                  <small>{criterion.fonte}</small>
                </label>
              ))}
            </div>
            <h3>Faixas de nota → elegibilidade (%)</h3>
            {!draft.faixas.length && (
              <p className="feedback warning">
                Nenhuma faixa configurada. A nota poderá ser calculada; o percentual automático
                ficará indisponível.
              </p>
            )}
            {draft.faixas.map((row, i) => (
              <div className="award-band" key={i}>
                {[
                  ["minimo", "Nota mínima"],
                  ["maximo", "Nota máxima"],
                  ["percentual", "Elegibilidade (%)"],
                ].map(([key, label]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      required
                      step={key === "percentual" ? "0.0001" : "0.01"}
                      min={key === "percentual" ? 0 : -5000}
                      max="100"
                      value={row[key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          faixas: draft.faixas.map((value, index) =>
                            index === i
                              ? {
                                  ...value,
                                  [key]: e.target.value === "" ? "" : Number(e.target.value),
                                }
                              : value,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, faixas: draft.faixas.filter((_, index) => index !== i) })
                  }
                >
                  Remover faixa
                </button>
              </div>
            ))}
            <div className="actions-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    faixas: [...draft.faixas, { minimo: "", maximo: "", percentual: "" }],
                  })
                }
              >
                Adicionar faixa
              </button>
              <button className="primary-button" type="submit">
                <Save size={18} />
                Publicar versão das regras
              </button>
              <button className="secondary-button" type="button" onClick={() => setDraft(null)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="dashboard-table">
        <table>
          <thead>
            <tr>
              <th>Versão publicada</th>
              <th>Categoria</th>
              <th>Critérios / faixas</th>
              <th>Criada em</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {paginacaoRegras.itensPaginados.map((rule) => (
              <tr key={rule.id}>
                <td title={rule.nome}>{rule.nome}</td>
                <td>{categories[rule.categoria]}</td>
                <td>
                  {rule.definicao.criterios.length} critérios · {rule.definicao.faixas.length}{" "}
                  faixas
                </td>
                <td>{date(rule.createdAt)}</td>
                <td>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      start({
                        nome: `${rule.nome} — revisão`,
                        categoria: rule.categoria,
                        ...rule.definicao,
                      })
                    }
                  >
                    Consultar / criar revisão
                  </button>
                </td>
              </tr>
            ))}
            {!rules.length && (
              <tr>
                <td colSpan={5} className="empty-cell">
                  Nenhuma versão publicada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginacaoTabela
        pagina={paginacaoRegras.pagina}
        totalPaginas={paginacaoRegras.totalPaginas}
        totalItens={paginacaoRegras.totalItens}
        inicio={paginacaoRegras.inicio}
        fim={paginacaoRegras.fim}
        onPageChange={paginacaoRegras.setPagina}
        rotulo="Páginas de versões publicadas das regras"
      />
    </section>
  );
}
