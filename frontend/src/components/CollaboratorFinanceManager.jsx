import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, WalletCards, X } from "lucide-react";
import { api } from "../api/client.js";
import { HelpDialog } from "./HelpDialog.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const inputDate = (value) => value ? String(value).slice(0, 10) : "";
const formatDate = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const currency = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rateLabel = (item) => `${item.nivel} — ${currency(item.valorHora)}/h`;
const nextDay = (value) => new Date(new Date(`${value}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
const minimumStart = (rows) => rows.length ? nextDay(rows.reduce((max, row) => {
  const boundary = inputDate(row.dataFim || row.dataInicio);
  return boundary > max ? boundary : max;
}, "")) : "";
const initialForm = (rows = []) => ({ itemTabelaId: "", beneficios: 0, dataInicio: [today(), minimumStart(rows)].sort().at(-1), motivo: "" });
function overlappingHistory(rows) {
  let lastEnd = "";
  for (const row of [...rows].sort((a, b) => inputDate(a.dataInicio).localeCompare(inputDate(b.dataInicio)))) {
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

export function CollaboratorFinanceManager({ collaborator, onChanged, onClose }) {
  const [configs, setConfigs] = useState([]);
  const [remunerations, setRemunerations] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isInactive = collaborator?.status === "INATIVO";
  const minStart = minimumStart(configs);
  const filteredConfigs = useMemo(() => configs.filter((config) => !statusFilter || statusOf(config) === statusFilter), [configs, statusFilter]);

  const loadConfigs = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoading(true);
    setError("");
    try {
      const [history, rates] = await Promise.all([
        api.get(`/colaboradores/${collaborator.id}/configuracoes-financeiras`),
        api.get("/remuneracoes", { params: { status: "ATIVO" } })
      ]);
      setConfigs(history.data);
      setRemunerations(rates.data);
      setFormData(initialForm(history.data));
    } catch (err) {
      setError(err.response?.data?.message || "Não foi possível carregar as configurações financeiras.");
    } finally { setLoading(false); }
  }, [collaborator?.id]);

  useEffect(() => {
    setConfigs([]); setRemunerations([]); setFormData(initialForm());
    setMessage(""); setError(""); setStatusFilter("");
    loadConfigs();
  }, [loadConfigs]);

  function update(event) {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (isInactive || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      await api.post(`/colaboradores/${collaborator.id}/configuracoes-financeiras`, formData);
      await loadConfigs();
      await onChanged?.();
      setMessage("Nova vigência criada com sucesso.");
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "Não foi possível criar a vigência.");
    } finally { setSaving(false); }
  }

  async function close(config) {
    if (isInactive || saving || !window.confirm("Encerrar esta vigência ao final de hoje? Os valores e o histórico serão preservados.")) return;
    setSaving(true); setMessage(""); setError("");
    try {
      await api.delete(`/colaboradores/${collaborator.id}/configuracoes-financeiras/${config.id}`);
      await loadConfigs(); await onChanged?.();
      setMessage("Vigência encerrada ao final de hoje. O histórico foi preservado.");
    } catch (err) {
      setError(err.response?.data?.message || "Não foi possível encerrar a vigência.");
    } finally { setSaving(false); }
  }

  function useAsBase(config) {
    if (!remunerations.some((item) => item.id === config.itemTabelaId)) {
      setError("A faixa desta vigência está inativa. Selecione uma faixa ativa no formulário de nova vigência.");
      return;
    }
    setFormData({ ...initialForm(configs), itemTabelaId: String(config.itemTabelaId), beneficios: config.beneficios, motivo: "Atualização de configuração financeira" });
    setError(""); setMessage("Faixa copiada para uma nova vigência. Confira o valor atual da tabela e a data antes de aplicar.");
  }

  return <section className="team-panel finance-history-panel">
    <header className="team-header">
      <div><span className="eyebrow">Configuração financeira</span><div className="dashboard-title-row"><h2>{collaborator.nomeCompleto}</h2><HelpDialog title="Ajuda — Configuração financeira">
        <section><h3>Nova vigência</h3><p>Escolha o nível de remuneração, os benefícios e a data. O valor/hora fica preservado nesta vigência. Editar a tabela de remuneração não altera os valores já vinculados; para aplicar a nova taxa, crie uma nova vigência.</p><p>Cargo e papel no projeto não escolhem a faixa automaticamente.</p></section>
        <section><h3>Datas e substituição</h3><p>A nova data deve ser posterior ao histórico existente e ao último apontamento já registrado. A primeira configuração pode cobrir horas que ainda estavam sem remuneração.</p><p>Ao criar uma nova vigência, a anterior termina no dia anterior ao novo início. A coluna Substituição e motivo mostra o nível, valor/hora e início da configuração substituída, mesmo quando o nível permanece igual e somente o valor muda.</p></section>
        <section><h3>Histórico e ações</h3><p>O histórico mostra os valores de cada período. Vigências futuras aparecem como Agendadas. Use o filtro para consultar vigências atuais, agendadas ou encerradas.</p><p>Usar como base preenche o formulário com a faixa e os benefícios anteriores, usando o valor atual da tabela. Confira o valor e a data antes de salvar. Encerrar vigência mantém o histórico e considera hoje como último dia.</p></section>
      </HelpDialog></div></div>
      <div className="team-header-actions">
        <span className="team-count"><WalletCards size={17} />{configs.filter((config) => !config.dataFim).length} em aberto</span>
        <button type="button" className="icon-button" onClick={onClose} title="Fechar financeiro" aria-label="Fechar financeiro"><X size={18} /></button>
      </div>
    </header>
    <div className="feedback-row">
      {isInactive && <div className="feedback warning"><AlertTriangle size={18} />Colaborador inativo: configurações financeiras disponíveis apenas para consulta.</div>}
      {overlappingHistory(configs) && <div className="feedback warning" role="status"><AlertTriangle size={18} />Há vigências com datas sobrepostas. Confira os períodos; o cálculo considera a configuração com início mais recente.</div>}
      {message && <div className="feedback success" role="status"><Check size={18} />{message}</div>}
      {error && <div className="feedback error" role="alert"><X size={18} />{error}</div>}
    </div>
    <h3>Nova vigência</h3>
    <form className="team-form finance-form" onSubmit={submit}>
      <label className="field"><span>Nível de remuneração / valor hora</span><select name="itemTabelaId" required value={formData.itemTabelaId} onChange={update} disabled={isInactive || loading || saving}>
        <option value="">Selecione a faixa e o valor/hora</option>
        {remunerations.map((item) => <option key={item.id} value={item.id}>{rateLabel(item)}</option>)}
      </select></label>
      <label className="field"><span>Benefícios</span><input name="beneficios" type="number" min="0" max="99999999.99" step="0.01" required value={formData.beneficios} onChange={update} disabled={isInactive || loading || saving} /></label>
      <label className="field"><span>Início da vigência</span><input name="dataInicio" type="date" required min={minStart || undefined} max="9999-12-31" value={formData.dataInicio} onChange={update} disabled={isInactive || loading || saving} /></label>
      <label className="field"><span>Motivo (opcional)</span><input name="motivo" type="text" maxLength={500} value={formData.motivo} onChange={update} disabled={isInactive || loading || saving} placeholder="Ex.: reajuste de remuneração" /></label>
      <button className="primary-button" type="submit" disabled={isInactive || saving || loading || !remunerations.length}><WalletCards size={18} />{saving ? "Salvando…" : "Criar nova vigência"}</button>
    </form>
    <div className="team-table-toolbar"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} title="Filtrar configurações por status">
      <option value="">Todas as vigências</option><option value="VIGENTE">Vigentes</option><option value="AGENDADA">Agendadas</option><option value="ENCERRADA">Encerradas</option>
    </select></div>
    <div className="table-wrap"><table><caption>Histórico financeiro — valores preservados em cada vigência</caption>
      <thead><tr><th>Nível preservado</th><th>Valor hora preservado</th><th>Benefícios</th><th>Início</th><th>Último dia</th><th>Status</th><th>Substituição e motivo</th><th>Ações</th></tr></thead>
      <tbody>{!filteredConfigs.length ? <tr><td colSpan="8" className="empty-cell">{loading ? "Carregando…" : "Nenhuma configuração financeira encontrada"}</td></tr> : filteredConfigs.map((config) => <tr key={config.id}>
        <td>{config.nivelAplicado}</td><td>{currency(config.valorHoraAplicado)}</td><td>{currency(config.beneficios)}</td>
        <td>{formatDate(config.dataInicio)}</td><td>{formatDate(config.dataFim)}</td>
        <td>{statusOf(config) === "AGENDADA" ? "Agendada" : <StatusBadge status={statusOf(config) === "VIGENTE" ? "ATIVO" : "INATIVO"} />}</td>
        <td>{(() => {
          const previous = configs.find((row) => row.id === config.anteriorId);
          const reason = config.motivo === "Preservação do valor disponível na migração" ? "" : config.motivo;
          return <><span>{previous ? `Substitui ${previous.nivelAplicado} · ${currency(previous.valorHoraAplicado)}/h (desde ${formatDate(previous.dataInicio)})` : config.anteriorId ? "Substitui a configuração anterior" : "Configuração inicial"}</span>{reason && <small className="finance-history-reason">{reason}</small>}</>;
        })()}</td>
        <td><div className="row-actions">
          {!isInactive && <button type="button" className="icon-button" onClick={() => useAsBase(config)} disabled={loading || saving} title="Usar como base de nova vigência" aria-label={`Usar ${config.nivelAplicado} de ${formatDate(config.dataInicio)} como base`}><Copy size={17} /></button>}
          {!isInactive && !config.dataFim && statusOf(config) !== "AGENDADA" && <button type="button" className="icon-button danger" onClick={() => close(config)} disabled={loading || saving} title="Encerrar vigência" aria-label={`Encerrar ${config.nivelAplicado} de ${formatDate(config.dataInicio)}`}><X size={17} /></button>}
        </div></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
