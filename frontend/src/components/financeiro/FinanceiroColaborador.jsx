/**
 * [COMPONENTE] Financeiro do colaborador (ação Financeiro na lista de colaboradores): histórico de
 * vigências de valor/hora, nova vigência e encerramento. Aberto também pelo aviso de custo
 * incompleto do dashboard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, WalletCards, X } from "lucide-react";
import { api } from "../../api/conexao.js";
import { useValorMaisRecente, useEscopoRequisicao } from "../../hooks/useEscopoRequisicao.js";
import { DialogoAjuda } from "../comum/DialogoAjuda.jsx";
import { DialogoConfirmacao } from "../comum/DialogoConfirmacao.jsx";
import { PaginacaoTabela, usePaginacao } from "../comum/PaginacaoTabela.jsx";
import { EtiquetaStatus } from "../comum/EtiquetaStatus.jsx";
import { todayBusinessDate as today } from "../../utils/datasEmpresa.js";
import { dataBr } from "../../utils/pendencias.js";
import { contemBusca } from "../../utils/textoBusca.js";

const inputDate = (value) => (value ? String(value).slice(0, 10) : "");
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const currency = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rateLabel = (item) => `${item.nivel} — ${currency(item.valorHora)}/h`;
const nextDay = (value) =>
  new Date(new Date(`${value}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
// [REGRA] Menor data de início aceita para a nova vigência (depois das anteriores).
const minimumStart = (rows) =>
  rows.length
    ? nextDay(
        rows.reduce((max, row) => {
          const boundary = inputDate(row.dataFim || row.dataInicio);
          return boundary > max ? boundary : max;
        }, ""),
      )
    : "";
const initialForm = (rows = []) => ({
  itemTabelaId: "",
  beneficios: 0,
  dataInicio: [today(), minimumStart(rows)].sort().at(-1),
  motivo: "",
});
function overlappingHistory(rows) {
  let lastEnd = "";
  for (const row of [...rows].sort((a, b) =>
    inputDate(a.dataInicio).localeCompare(inputDate(b.dataInicio)),
  )) {
    if (lastEnd >= inputDate(row.dataInicio)) return true;
    const end = inputDate(row.dataFim) || "9999-12-31";
    if (end > lastEnd) lastEnd = end;
  }
  return false;
}

function statusOf(config) {
  const day = today();
  if (inputDate(config.dataInicio) > day) return "AGENDADA";
  if (config.dataFim && inputDate(config.dataFim) < day) return "ENCERRADA";
  return "VIGENTE";
}

const cobreData = (config, dia) =>
  inputDate(config.dataInicio) <= dia && (!config.dataFim || inputDate(config.dataFim) >= dia);

// `pendencia` vem do Dashboard Geral ({ data }): horas lançadas sem valor/hora vigente.
// Sem nenhuma vigência, a tela já preenche o início com essa data.
export function FinanceiroColaborador({ collaborator, onChanged, onClose, pendencia = null }) {
  const requestScope = useEscopoRequisicao(collaborator?.id);
  const callbacks = useValorMaisRecente({ onChanged });
  const [loadError, setLoadError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [configs, setConfigs] = useState([]);
  const [remunerations, setRemunerations] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [statusFilter, setStatusFilter] = useState("");
  const [buscaConfigs, setBuscaConfigs] = useState("");
  const [loading, setLoading] = useState(false);
  // Histórico já carregado para este colaborador (a pendência só é conferida depois disso).
  const [carregado, setCarregado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingConfig, setClosingConfig] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isInactive = collaborator?.status === "INATIVO";
  const minStart = minimumStart(configs);
  const filteredConfigs = useMemo(
    () =>
      configs.filter(
        (config) =>
          (!statusFilter || statusOf(config) === statusFilter) &&
          contemBusca(
            buscaConfigs,
            config.nivelAplicado,
            config.itemTabela?.nivel,
            config.motivo,
            String(config.valorHoraAplicado ?? "").replace(".", ","),
          ),
      ),
    [configs, statusFilter, buscaConfigs],
  );
  const paginacaoConfigs = usePaginacao(filteredConfigs);

  // [REQUISICAO] GET das vigências do colaborador.
  const loadConfigs = useCallback(async () => {
    if (!collaborator?.id) return;
    const request = requestScope.begin("load");
    setLoadError("");
    setLoading(true);
    setError("");
    try {
      const [history, rates] = await Promise.all([
        api.get(`/colaboradores/${collaborator.id}/configuracoes-financeiras`, {
          signal: request.signal,
        }),
        api.get("/remuneracoes", { params: { status: "ATIVO" }, signal: request.signal }),
      ]);
      if (!request.isCurrent()) return;
      setConfigs(history.data);
      setRemunerations(rates.data);
      setFormData(initialForm(history.data));
      setCarregado(true);
    } catch (err) {
      if (!request.isCurrent()) return;
      setConfigs([]);
      setRemunerations([]);
      setLoadError(
        err.response?.data?.message || "Não foi possível carregar as configurações financeiras.",
      );
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [collaborator?.id, requestScope]);

  useEffect(() => {
    setConfigs([]);
    setRemunerations([]);
    setSaving(false);
    setClosingConfig(null);
    setLoadError("");
    setFormData(initialForm());
    setCarregado(false);
    setSelectionError("");
    setMessage("");
    setError("");
    setStatusFilter("");
    loadConfigs();
  }, [loadConfigs]);

  function update(event) {
    if (event.target.name === "itemTabelaId") setSelectionError("");
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  // [REQUISICAO] Cria a nova vigência (POST). A anterior é encerrada pela API.
  async function submit(event) {
    event.preventDefault();
    if (isInactive || saving || loading || loadError) return;
    if (!remunerations.some((rate) => String(rate.id) === String(formData.itemTabelaId))) {
      setSelectionError("Selecione uma faixa de remuneração disponível.");
      document.getElementById("finance-rate")?.focus();
      return;
    }
    setSelectionError("");
    const request = requestScope.begin("mutation");
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.post(`/colaboradores/${collaborator.id}/configuracoes-financeiras`, formData);
      if (!request.isCurrent()) return;
      await loadConfigs();
      if (!request.isCurrent()) return;
      await callbacks.current.onChanged?.();
      if (!request.isCurrent()) return;
      setMessage("Nova vigência criada com sucesso.");
    } catch (err) {
      if (!request.isCurrent()) return;
      setError(
        err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          "Não foi possível criar a vigência.",
      );
    } finally {
      if (request.isCurrent()) setSaving(false);
    }
  }

  // [REQUISICAO] Encerra a vigência aberta hoje (DELETE), após confirmação no modal.
  function close(config) {
    if (isInactive || saving || loading || loadError) return;
    setClosingConfig(config);
  }

  async function confirmClose() {
    const config = closingConfig;
    if (!config || isInactive || saving || loading || loadError) return;
    setClosingConfig(null);
    const request = requestScope.begin("mutation");
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.delete(`/colaboradores/${collaborator.id}/configuracoes-financeiras/${config.id}`);
      if (!request.isCurrent()) return;
      await loadConfigs();
      if (!request.isCurrent()) return;
      await callbacks.current.onChanged?.();
      if (!request.isCurrent()) return;
      setMessage("Vigência encerrada ao final de hoje. O histórico foi preservado.");
    } catch (err) {
      if (!request.isCurrent()) return;
      setError(err.response?.data?.message || "Não foi possível encerrar a vigência.");
    } finally {
      if (request.isCurrent()) setSaving(false);
    }
  }

  // Preenche o formulário com a faixa e os benefícios de uma vigência anterior.
  function usarComoBase(config) {
    if (loading || saving || loadError) return;
    if (!remunerations.some((item) => item.id === config.itemTabelaId)) {
      setError(
        "A faixa desta vigência está inativa. Selecione uma faixa ativa no formulário de nova vigência.",
      );
      return;
    }
    setFormData({
      ...initialForm(configs),
      itemTabelaId: String(config.itemTabelaId),
      beneficios: config.beneficios,
      motivo: "Atualização de configuração financeira",
    });
    setError("");
    setMessage(
      "Faixa copiada para uma nova vigência. Confira o valor atual da tabela e a data antes de aplicar.",
    );
  }

  const preenchido = useRef("");
  const situacaoFinanceira =
    pendencia && carregado && !loading && !loadError
      ? configs.some((config) => cobreData(config, pendencia.data))
        ? "coberto"
        : configs.length
          ? "historico"
          : "sem-vigencia"
      : null;

  useEffect(() => {
    if (situacaoFinanceira !== "sem-vigencia") return;
    const chave = `${collaborator?.id}:${pendencia.data}`;
    if (preenchido.current === chave) return;
    preenchido.current = chave;
    setFormData((current) => ({ ...current, dataInicio: pendencia.data }));
  }, [situacaoFinanceira, pendencia, collaborator?.id]);

  return (
    <section className="team-panel finance-history-panel">
      <header className="team-header">
        <div>
          <span className="eyebrow">Configuração financeira</span>
          <div className="dashboard-title-row">
            <h2>{collaborator.nomeCompleto}</h2>
            <DialogoAjuda title="Ajuda — Configuração financeira">
              <section>
                <h3>Nova vigência</h3>
                <p>
                  Escolha o nível de remuneração, os benefícios e a data. O valor/hora fica
                  preservado nesta vigência. Os benefícios são apenas informativos: o custo das
                  horas usa somente o valor/hora e a bonificação do papel. Editar a tabela de
                  remuneração não altera os valores já vinculados; para aplicar a nova taxa, crie
                  uma nova vigência.
                </p>
                <p>Cargo e papel no projeto não escolhem a faixa automaticamente.</p>
              </section>
              <section>
                <h3>Datas e substituição</h3>
                <p>
                  A nova data deve ser posterior ao histórico existente e ao último apontamento já
                  registrado. A primeira configuração pode cobrir horas que ainda estavam sem
                  remuneração.
                </p>
                <p>
                  Ao criar uma nova vigência, a anterior termina no dia anterior ao novo início. A
                  coluna Substituição e motivo mostra o nível, valor/hora e início da configuração
                  substituída, mesmo quando o nível permanece igual e somente o valor muda.
                </p>
              </section>
              <section>
                <h3>Histórico e ações</h3>
                <p>
                  O histórico mostra os valores de cada período. Vigências futuras aparecem como
                  Agendadas. Use o filtro para consultar vigências atuais, agendadas ou encerradas.
                </p>
                <p>
                  Usar como base preenche o formulário com a faixa e os benefícios anteriores,
                  usando o valor atual da tabela. Confira o valor e a data antes de salvar. Encerrar
                  vigência mantém o histórico e considera hoje como último dia.
                </p>
              </section>
            </DialogoAjuda>
          </div>
        </div>
        <div className="team-header-actions">
          <span className="team-count">
            <WalletCards size={17} />
            {configs.filter((config) => !config.dataFim).length} em aberto
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            title="Fechar financeiro"
            aria-label="Fechar financeiro"
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="feedback-row">
        {situacaoFinanceira && (
          <div
            className={`feedback ${situacaoFinanceira === "coberto" ? "success" : "warning"} pending-fix`}
            role="status"
          >
            <strong>Pendência do dashboard</strong>
            {situacaoFinanceira === "sem-vigencia" && (
              <span>
                {collaborator.nomeCompleto} lançou horas em {dataBr(pendencia.data)} sem valor/hora
                vigente, por isso elas ficaram sem custo. O formulário abaixo já vem com essa data
                de início: escolha o nível de remuneração e clique em Criar nova vigência.
              </span>
            )}
            {situacaoFinanceira === "historico" && (
              <span>
                {collaborator.nomeCompleto} lançou horas em {dataBr(pendencia.data)}, fora das
                vigências abaixo. Como o histórico financeiro não pode ser alterado e uma nova
                vigência não pode começar antes das existentes, essa data não pode ser coberta por
                aqui. Se a data do apontamento estiver errada, corrija-a em Apontamento de Horas.
              </span>
            )}
            {situacaoFinanceira === "coberto" && (
              <span>
                Resolvido: há vigência em {dataBr(pendencia.data)}. Atualize o Dashboard Geral para
                ver o custo completo.
              </span>
            )}
          </div>
        )}
        {loadError && (
          <div className="feedback error" role="alert">
            {loadError}
            <button type="button" onClick={loadConfigs}>
              Tentar novamente
            </button>
          </div>
        )}
        {isInactive && (
          <div className="feedback warning">
            <AlertTriangle size={18} />
            Colaborador inativo: configurações financeiras disponíveis apenas para consulta.
          </div>
        )}
        {overlappingHistory(configs) && (
          <div className="feedback warning" role="status">
            <AlertTriangle size={18} />
            Há vigências com datas sobrepostas. Confira os períodos; o cálculo considera a
            configuração com início mais recente.
          </div>
        )}
        {message && (
          <div className="feedback success" role="status">
            <Check size={18} />
            {message}
          </div>
        )}
        {error && (
          <div className="feedback error" role="alert">
            <X size={18} />
            {error}
          </div>
        )}
      </div>
      <h3>Nova vigência</h3>
      <form className="team-form finance-form" onSubmit={submit}>
        <label className="field">
          <span>Nível de remuneração / valor hora</span>
          <select
            id="finance-rate"
            aria-invalid={Boolean(selectionError)}
            aria-describedby={selectionError ? "finance-rate-error" : undefined}
            name="itemTabelaId"
            required
            value={formData.itemTabelaId}
            onChange={update}
            disabled={isInactive || loading || saving || Boolean(loadError)}
          >
            <option value="">Selecione a faixa e o valor/hora</option>
            {remunerations.map((item) => (
              <option key={item.id} value={item.id}>
                {rateLabel(item)}
              </option>
            ))}
          </select>
          {selectionError && (
            <small id="finance-rate-error" role="alert">
              {selectionError}
            </small>
          )}
        </label>
        <label className="field">
          <span>Benefícios (informativo)</span>
          <input
            name="beneficios"
            aria-describedby="finance-benefits-hint"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            required
            value={formData.beneficios}
            onChange={update}
            disabled={isInactive || loading || saving || Boolean(loadError)}
          />
          <small id="finance-benefits-hint">
            Apenas registro: não entra no custo das horas nem nos indicadores.
          </small>
        </label>
        <label className="field">
          <span>Início da vigência</span>
          <input
            name="dataInicio"
            type="date"
            required
            min={minStart || undefined}
            max="9999-12-31"
            value={formData.dataInicio}
            onChange={update}
            disabled={isInactive || loading || saving || Boolean(loadError)}
          />
        </label>
        <label className="field">
          <span>Motivo (opcional)</span>
          <input
            name="motivo"
            type="text"
            maxLength={500}
            value={formData.motivo}
            onChange={update}
            disabled={isInactive || loading || saving || Boolean(loadError)}
            placeholder="Ex.: reajuste de remuneração"
          />
        </label>
        <button
          className="primary-button"
          type="submit"
          disabled={isInactive || saving || loading || Boolean(loadError) || !remunerations.length}
        >
          <WalletCards size={18} />
          {saving ? "Salvando…" : "Criar nova vigência"}
        </button>
      </form>
      <div className="team-table-toolbar">
        <label className="field">
          <span>Buscar</span>
          <input
            value={buscaConfigs}
            onChange={(event) => {
              setBuscaConfigs(event.target.value);
              paginacaoConfigs.setPagina(1);
            }}
            placeholder="Nível, valor/hora ou motivo"
          />
        </label>
        <label className="field">
          <span>Mostrar</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              paginacaoConfigs.setPagina(1);
            }}
            title="Filtrar configurações por status"
          >
            <option value="">Todas as vigências</option>
            <option value="VIGENTE">Vigentes</option>
            <option value="AGENDADA">Agendadas</option>
            <option value="ENCERRADA">Encerradas</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <caption>Histórico financeiro — valores preservados em cada vigência</caption>
          <thead>
            <tr>
              <th>Nível preservado</th>
              <th>Valor hora preservado</th>
              <th>Benefícios (informativo)</th>
              <th>Início</th>
              <th>Último dia</th>
              <th>Status</th>
              <th>Substituição e motivo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {!filteredConfigs.length ? (
              <tr>
                <td colSpan="8" className="empty-cell">
                  {loading ? "Carregando…" : "Nenhuma configuração financeira encontrada"}
                </td>
              </tr>
            ) : (
              paginacaoConfigs.itensPaginados.map((config) => (
                <tr key={config.id}>
                  <td>{config.nivelAplicado}</td>
                  <td>{currency(config.valorHoraAplicado)}</td>
                  <td>{currency(config.beneficios)}</td>
                  <td>{formatDate(config.dataInicio)}</td>
                  <td>{formatDate(config.dataFim)}</td>
                  <td>
                    {statusOf(config) === "AGENDADA" ? (
                      "Agendada"
                    ) : (
                      <EtiquetaStatus
                        status={statusOf(config) === "VIGENTE" ? "ATIVO" : "INATIVO"}
                      />
                    )}
                  </td>
                  <td>
                    {(() => {
                      const previous = configs.find((row) => row.id === config.anteriorId);
                      const reason =
                        config.motivo === "Preservação do valor disponível na migração"
                          ? ""
                          : config.motivo;
                      return (
                        <>
                          <span>
                            {previous
                              ? `Substitui ${previous.nivelAplicado} · ${currency(previous.valorHoraAplicado)}/h (desde ${formatDate(previous.dataInicio)})`
                              : config.anteriorId
                                ? "Substitui a configuração anterior"
                                : "Configuração inicial"}
                          </span>
                          {reason && (
                            <small className="finance-history-reason" title={reason}>
                              {reason}
                            </small>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td>
                    <div className="row-actions">
                      {!isInactive && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => usarComoBase(config)}
                          disabled={loading || saving || Boolean(loadError)}
                          title="Usar como base de nova vigência"
                          aria-label={`Usar ${config.nivelAplicado} de ${formatDate(config.dataInicio)} como base`}
                        >
                          <Copy size={17} />
                        </button>
                      )}
                      {!isInactive && !config.dataFim && statusOf(config) !== "AGENDADA" && (
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => close(config)}
                          disabled={loading || saving || Boolean(loadError)}
                          title="Encerrar vigência"
                          aria-label={`Encerrar ${config.nivelAplicado} de ${formatDate(config.dataInicio)}`}
                        >
                          <X size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginacaoTabela
        pagina={paginacaoConfigs.pagina}
        totalPaginas={paginacaoConfigs.totalPaginas}
        totalItens={paginacaoConfigs.totalItens}
        inicio={paginacaoConfigs.inicio}
        fim={paginacaoConfigs.fim}
        onPageChange={paginacaoConfigs.setPagina}
        rotulo="Páginas do histórico financeiro"
      />
      {closingConfig && (
        <DialogoConfirmacao
          title="Encerrar vigência financeira"
          description={`Encerrar a vigência "${closingConfig.nivelAplicado}" (início em ${formatDate(closingConfig.dataInicio)}) ao final de hoje? Os valores e o histórico serão preservados.`}
          confirmLabel="Encerrar vigência"
          danger
          busy={saving}
          onConfirm={confirmClose}
          onCancel={() => setClosingConfig(null)}
        />
      )}
    </section>
  );
}
