import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Save, WalletCards, X } from "lucide-react";
import { api } from "../api/client.js";
import { StatusBadge } from "./StatusBadge.jsx";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function currency(value) {
  const number = Number(value || 0);
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function decimal(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function remunerationLabel(item) {
  if (!item) {
    return "Selecione";
  }

  return `${item.nivel} - ${currency(item.valorHora)}/h`;
}

function bonusLabel(item) {
  const value = Number(item?.bonificacao || 0);

  if (!item || item.tipoBonificacao === "NENHUMA" || value === 0) {
    return "-";
  }

  if (item.tipoBonificacao === "PERCENTUAL") {
    return `${decimal(value)}%`;
  }

  return currency(value);
}

function configStatus(config) {
  return config.dataFim ? "INATIVO" : "ATIVO";
}

export function CollaboratorFinanceManager({ collaborator, onChanged, onClose }) {
  const [configs, setConfigs] = useState([]);
  const [remunerations, setRemunerations] = useState([]);
  const [formData, setFormData] = useState({
    itemTabelaId: "",
    beneficios: 0,
    dataInicio: today()
  });
  const [editingConfigs, setEditingConfigs] = useState({});
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isInactive = collaborator?.status === "INATIVO";
  const activeConfigCount = configs.filter((config) => !config.dataFim).length;

  const filteredConfigs = useMemo(() => {
    if (statusFilter === "ATIVO") {
      return configs.filter((config) => !config.dataFim);
    }

    if (statusFilter === "INATIVO") {
      return configs.filter((config) => config.dataFim);
    }

    return configs;
  }, [configs, statusFilter]);

  const loadConfigs = useCallback(async () => {
    if (!collaborator?.id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [configsResponse, remunerationsResponse] = await Promise.all([
        api.get(`/colaboradores/${collaborator.id}/configuracoes-financeiras`),
        api.get("/remuneracoes", { params: { status: "ATIVO" } })
      ]);

      setConfigs(configsResponse.data);
      setRemunerations(remunerationsResponse.data);
      setEditingConfigs(
        Object.fromEntries(
          configsResponse.data.map((config) => [
            config.id,
            {
              itemTabelaId: String(config.itemTabelaId),
              beneficios: String(config.beneficios ?? 0)
            }
          ])
        )
      );

      setFormData((current) => ({
        ...current,
        itemTabelaId: current.itemTabelaId || String(remunerationsResponse.data[0]?.id || "")
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível carregar as configurações financeiras.");
    } finally {
      setLoading(false);
    }
  }, [collaborator?.id]);

  useEffect(() => {
    setConfigs([]);
    setMessage("");
    setError("");
    setStatusFilter("");
    setFormData({
      itemTabelaId: "",
      beneficios: 0,
      dataInicio: today()
    });
    loadConfigs();
  }, [loadConfigs]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isInactive) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api.post(`/colaboradores/${collaborator.id}/configuracoes-financeiras`, formData);
      setMessage("Configuração financeira aplicada. A vigência anterior foi encerrada automaticamente.");
      setFormData({
        itemTabelaId: String(remunerations[0]?.id || ""),
        beneficios: 0,
        dataInicio: today()
      });
      await loadConfigs();
      await onChanged?.();
    } catch (requestError) {
      const response = requestError.response?.data;
      const validationMessage = response?.errors?.[0]?.message;
      setError(validationMessage || response?.message || "Não foi possível aplicar a configuração financeira.");
    } finally {
      setSaving(false);
    }
  }

  async function updateConfig(config) {
    if (isInactive) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api.put(`/colaboradores/${collaborator.id}/configuracoes-financeiras/${config.id}`, {
        itemTabelaId: editingConfigs[config.id]?.itemTabelaId,
        beneficios: editingConfigs[config.id]?.beneficios
      });
      setMessage("Configuração financeira atualizada.");
      await loadConfigs();
      await onChanged?.();
    } catch (requestError) {
      const response = requestError.response?.data;
      const validationMessage = response?.errors?.[0]?.message;
      setError(validationMessage || response?.message || "Não foi possível atualizar a configuração financeira.");
    }
  }

  async function closeConfig(config) {
    if (isInactive) {
      return;
    }

    if (!window.confirm("Encerrar a configuração financeira vigente deste colaborador?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api.delete(`/colaboradores/${collaborator.id}/configuracoes-financeiras/${config.id}`);
      setMessage("Configuração financeira encerrada e histórico preservado.");
      await loadConfigs();
      await onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível encerrar a configuração financeira.");
    }
  }

  function selectedRemuneration(config) {
    const editingItemId = Number(editingConfigs[config.id]?.itemTabelaId);
    return remunerations.find((item) => item.id === editingItemId) || config.itemTabela;
  }

  return (
    <section className="team-panel">
      <header className="team-header">
        <div>
          <span className="eyebrow">Configuração financeira</span>
          <h2>{collaborator.nomeCompleto}</h2>
        </div>
        <div className="team-header-actions">
          <span className="team-count">
            <WalletCards size={17} />
            {activeConfigCount} vigente{activeConfigCount === 1 ? "" : "s"}
          </span>
          <button className="icon-button" type="button" onClick={onClose} title="Fechar financeiro">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="feedback-row">
        {isInactive ? (
          <div className="feedback warning">
            <AlertTriangle size={18} />
            Colaborador inativo: configurações financeiras disponíveis apenas para consulta.
          </div>
        ) : null}
        {message ? (
          <div className="feedback success">
            <Check size={18} />
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="feedback error">
            <X size={18} />
            {error}
          </div>
        ) : null}
      </div>

      <form className="team-form finance-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Faixa de remuneração</span>
          <select
            value={formData.itemTabelaId}
            required
            disabled={isInactive || loading}
            onChange={(event) =>
              setFormData((current) => ({ ...current, itemTabelaId: event.target.value }))
            }
          >
            <option value="">Selecione</option>
            {remunerations.map((item) => (
              <option key={item.id} value={item.id}>
                {remunerationLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Benefícios</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.beneficios}
            required
            disabled={isInactive || loading}
            onChange={(event) =>
              setFormData((current) => ({ ...current, beneficios: event.target.value }))
            }
          />
        </label>

        <label className="field">
          <span>Início da vigência</span>
          <input
            type="date"
            value={formData.dataInicio}
            required
            disabled={isInactive || loading}
            onChange={(event) =>
              setFormData((current) => ({ ...current, dataInicio: event.target.value }))
            }
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={isInactive || saving || loading || remunerations.length === 0}
          title="Aplicar configuração"
        >
          <WalletCards size={18} />
          Aplicar
        </button>
      </form>

      <div className="team-table-toolbar">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          title="Filtrar configurações por status"
        >
          <option value="">Todas as vigências</option>
          <option value="ATIVO">Vigentes</option>
          <option value="INATIVO">Encerradas</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>Valor hora</th>
              <th>Bonificação</th>
              <th>Benefícios</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredConfigs.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan="8">
                  {loading ? "Carregando configurações" : "Nenhuma configuração financeira encontrada"}
                </td>
              </tr>
            ) : (
              filteredConfigs.map((config) => {
                const currentItem = selectedRemuneration(config);

                return (
                  <tr key={config.id}>
                    <td>
                      {config.dataFim ? (
                        config.itemTabela?.nivel || "-"
                      ) : (
                        <select
                          value={editingConfigs[config.id]?.itemTabelaId || config.itemTabelaId}
                          disabled={isInactive}
                          onChange={(event) =>
                            setEditingConfigs((current) => ({
                              ...current,
                              [config.id]: {
                                ...current[config.id],
                                itemTabelaId: event.target.value
                              }
                            }))
                          }
                        >
                          {remunerations.map((item) => (
                            <option key={item.id} value={item.id}>
                              {remunerationLabel(item)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{currency(currentItem?.valorHora)}</td>
                    <td>{bonusLabel(currentItem)}</td>
                    <td>
                      {config.dataFim ? (
                        currency(config.beneficios)
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingConfigs[config.id]?.beneficios ?? config.beneficios}
                          disabled={isInactive}
                          onChange={(event) =>
                            setEditingConfigs((current) => ({
                              ...current,
                              [config.id]: {
                                ...current[config.id],
                                beneficios: event.target.value
                              }
                            }))
                          }
                        />
                      )}
                    </td>
                    <td>{formatDate(config.dataInicio)}</td>
                    <td>{formatDate(config.dataFim)}</td>
                    <td>
                      <StatusBadge status={configStatus(config)} />
                    </td>
                    <td>
                      <div className="row-actions">
                        {!config.dataFim && !isInactive ? (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => updateConfig(config)}
                              title="Salvar configuração"
                            >
                              <Save size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => closeConfig(config)}
                              title="Encerrar vigência"
                            >
                              <X size={17} />
                            </button>
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
