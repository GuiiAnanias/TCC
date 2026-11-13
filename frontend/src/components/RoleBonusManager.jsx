/**
 * [COMPONENTE] Bonificação por papel no projeto (tela Remuneração): histórico das regras por papel
 * e cadastro de uma nova regra com data de início.
 */

import React, { useCallback, useEffect, useState } from "react";
import { HelpDialog } from "./HelpDialog.jsx";
import { api } from "../api/client.js";

const date = (value) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
import { todayBusinessDate as today } from "../utils/businessDates.js";

export function RoleBonusManager() {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ papel: "", percentual: "", dataInicio: today() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // [REQUISICAO] GET /bonificacoes-papeis.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, options] = await Promise.all([
        api.get("/bonificacoes-papeis"),
        api.get("/projetos/papeis"),
      ]);
      setRows(history.data);
      setRoles(options.data);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Não foi possível carregar as bonificações por papel.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // [REQUISICAO] POST de uma nova regra; erros de vigência vêm da API.
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.post("/bonificacoes-papeis", form);
      setMessage("Bonificação salva. A vigência anterior foi preservada no histórico.");
      setForm((current) => ({ ...current, percentual: "" }));
      await load();
    } catch (err) {
      setError(
        err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.message ||
          "Não foi possível salvar a bonificação.",
      );
    } finally {
      setSaving(false);
    }
  }
  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <section className="form-panel role-bonus-panel">
      <div className="dashboard-title-row">
        <h2>Bonificação por papel no projeto</h2>
        <HelpDialog title="Ajuda — Bonificação por papel">
          <section>
            <h3>Base de cálculo</h3>
            <p>
              A bonificação é um percentual sobre o custo das horas, conforme o papel exercido no
              projeto e a regra vigente na data do apontamento.
            </p>
            <p className="dashboard-help-formula">
              8 horas × R$ 45/h = R$ 360 de base. Com 10% de bonificação, são R$ 36 de bônus e R$
              396 de custo total.
            </p>
            <p>
              O percentual é definido pela empresa. A avaliação de premiação não interfere neste
              cálculo.
            </p>
          </section>
          <section>
            <h3>Vigências</h3>
            <p>
              Cadastro opcional: papéis sem bonificação vigente usam 0%, sem bloquear os
              indicadores. Cadastre uma regra somente quando houver bônus. Para encerrar um bônus
              existente, salve uma nova vigência com 0%. As vigências anteriores são preservadas.
            </p>
          </section>
        </HelpDialog>
      </div>
      {error && (
        <div className="feedback error" role="alert">
          {error}
          <button type="button" className="secondary-button" onClick={load} disabled={loading}>
            Tentar novamente
          </button>
        </div>
      )}
      {message && (
        <div className="feedback success" role="status">
          {message}
        </div>
      )}
      <form onSubmit={submit}>
        <fieldset className="form-grid role-bonus-fields" disabled={loading || saving}>
          <label className="field">
            <span>Papel no projeto</span>
            <select name="papel" required value={form.papel} onChange={update}>
              <option value="">Selecione</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bonificação (%)</span>
            <input
              name="percentual"
              type="number"
              required
              min="0"
              max="99999999.99"
              step="0.01"
              value={form.percentual}
              onChange={update}
              placeholder="Ex.: 10"
            />
          </label>
          <label className="field">
            <span>Início da vigência</span>
            <input
              name="dataInicio"
              type="date"
              required
              value={form.dataInicio}
              onChange={update}
            />
          </label>
          <button type="submit" className="primary-button">
            {saving ? "Salvando…" : "Salvar nova vigência"}
          </button>
        </fieldset>
      </form>
      <div className="dashboard-table">
        <table>
          <caption>Histórico de bonificações por papel</caption>
          <thead>
            <tr>
              <th>Papel</th>
              <th>Percentual</th>
              <th>Início</th>
              <th>Último dia da vigência</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan="4" className="empty-cell">
                  {loading ? "Carregando…" : "Nenhuma bonificação por papel cadastrada"}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.papel}</td>
                  <td>{Number(row.percentual).toLocaleString("pt-BR")}%</td>
                  <td>{date(row.dataInicio)}</td>
                  <td>
                    {row.dataFim
                      ? date(new Date(new Date(row.dataFim).getTime() - 86400000))
                      : "Sem data final"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
