import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Edit3, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, UsersRound, WalletCards, X } from "lucide-react";
import { api } from "../api/client.js";
import { CollaboratorFinanceManager } from "../components/CollaboratorFinanceManager.jsx";
import { ProjectTeamManager } from "../components/ProjectTeamManager.jsx";
import { SearchableSelect } from "../components/SearchableSelect.jsx";

function getInitialForm(fields, isEditing = false) {
  return fields.reduce((accumulator, field) => {
    if (field.hiddenOnCreate && !isEditing) {
      return accumulator;
    }

    accumulator[field.name] = field.defaultValue ?? "";
    return accumulator;
  }, {});
}

function toInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function readValue(item, column) {
  if (column.render) {
    return column.render(item);
  }

  return item[column.key] ?? "-";
}

function buildPayload(fields, formData, isEditing) {
  return fields.reduce((payload, field) => {
    if (field.hiddenOnCreate && !isEditing) {
      return payload;
    }

    const value = formData[field.name];

    if (value !== "" && value !== null && value !== undefined) {
      payload[field.name] = value;
    }

    return payload;
  }, {});
}

export function CrudPage({ config }) {
  const [records, setRecords] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [filters, setFilters] = useState({ busca: "", status: "" });
  const [formData, setFormData] = useState(() => getInitialForm(config.fields));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const isEditing = Boolean(editingId);

  const visibleFields = useMemo(
    () => config.fields.filter((field) => !field.hiddenOnCreate || isEditing),
    [config.fields, isEditing]
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(config.endpoint, {
        params: {
          busca: filters.busca || undefined,
          status: filters.status || undefined
        }
      });

      setRecords(data);
      setSelectedRecord((current) => {
        if (!current || (!config.teamManager && !config.financeManager)) {
          return current;
        }

        return data.find((record) => record.id === current.id) || null;
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, filters.busca, filters.status]);

  const loadClientes = useCallback(async () => {
    if (!config.loadClientes) {
      return;
    }

    try {
      const { data } = await api.get("/clientes", {
        params: { status: "ATIVO" }
      });

      setClientes(data);
    } catch {
      setClientes([]);
    }
  }, [config.loadClientes]);

  const loadProjetos = useCallback(async () => {
    if (!config.loadProjetos) {
      return;
    }

    try {
      const { data } = await api.get("/projetos", {
        params: { status: "ATIVO" }
      });
      setProjetos(data);
    } catch {
      setProjetos([]);
    }
  }, [config.loadProjetos]);

  const loadColaboradores = useCallback(async () => {
    if (!config.loadColaboradores) {
      return;
    }

    try {
      const { data } = await api.get("/colaboradores", {
        params: { status: "ATIVO" }
      });
      setColaboradores(data);
    } catch {
      setColaboradores([]);
    }
  }, [config.loadColaboradores]);

  useEffect(() => {
    setFormData(getInitialForm(config.fields));
    setEditingId(null);
    setMessage("");
    setError("");
    setFilters({ busca: "", status: "" });
    setSelectedRecord(null);
  }, [config]);

  useEffect(() => {
    loadRecords();
    loadClientes();
    loadProjetos();
    loadColaboradores();
  }, [loadRecords, loadClientes, loadProjetos, loadColaboradores]);

  function resetForm() {
    setFormData(getInitialForm(config.fields));
    setEditingId(null);
    setMessage("");
    setError("");
  }

  function handleEdit(record) {
    const nextForm = getInitialForm(config.fields, true);

    config.fields.forEach((field) => {
      if (field.type === "date") {
        nextForm[field.name] = toInputDate(record[field.name]);
        return;
      }

      nextForm[field.name] = record[field.name] ?? field.defaultValue ?? "";
    });

    setFormData(nextForm);
    setEditingId(record.id);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = buildPayload(config.fields, formData, isEditing);

      if (isEditing) {
        await api.put(`${config.endpoint}/${editingId}`, payload);
        setMessage(`${config.singular} atualizado com sucesso.`);
      } else {
        await api.post(config.endpoint, payload);
        setMessage(`${config.singular} cadastrado com sucesso.`);
      }

      resetForm();
      await loadRecords();
      await loadClientes();
    } catch (requestError) {
      const response = requestError.response?.data;
      const validationMessage = response?.errors?.[0]?.message;
      setError(validationMessage || response?.message || "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInactivate(record) {
    const confirmMessage = `Inativar ${config.singular} "${record.nome || record.nomeCompleto || record.nivel}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`${config.endpoint}/${record.id}`);
      setMessage(`${config.singular} inativado com sucesso.`);
      await loadRecords();
      await loadClientes();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível inativar o registro.");
    }
  }

  function renderField(field) {
    const commonProps = {
      id: field.name,
      name: field.name,
      value: formData[field.name] ?? "",
      required: field.required,
      onChange: (event) => setFormData((current) => ({ ...current, [field.name]: event.target.value }))
    };

    if (field.type === "select") {
      return (
        <select {...commonProps}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "cliente") {
      const clienteOptions = clientes.map((cliente) => ({
        value: String(cliente.id),
        label: cliente.nome
      }));

      return (
        <SearchableSelect
          name={field.name}
          options={clienteOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) => setFormData((current) => ({ ...current, [field.name]: event.target.value }))}
          placeholder="Buscar cliente..."
        />
      );
    }

    if (field.type === "projeto") {
      const projetoOptions = projetos.map((projeto) => ({
        value: String(projeto.id),
        label: projeto.nome
      }));

      return (
        <SearchableSelect
          name={field.name}
          options={projetoOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) => setFormData((current) => ({ ...current, [field.name]: event.target.value }))}
          placeholder="Buscar projeto..."
        />
      );
    }

    if (field.type === "colaborador") {
      const colaboradorOptions = colaboradores.map((colaborador) => ({
        value: String(colaborador.id),
        label: colaborador.nomeCompleto
      }));

      return (
        <SearchableSelect
          name={field.name}
          options={colaboradorOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) => setFormData((current) => ({ ...current, [field.name]: event.target.value }))}
          placeholder="Buscar colaborador..."
        />
      );
    }

    return (
      <input
        {...commonProps}
        type={field.type}
        min={field.min}
        step={field.step}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <section className="content-panel">
      <header className="page-header">
        <div>
          <span className="eyebrow">Cadastro</span>
          <h1>{config.title}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadRecords} disabled={loading} title="Atualizar">
          <RefreshCw size={18} />
          Atualizar
        </button>
      </header>

      <div className="feedback-row">
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

      <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-title">
          <Plus size={18} />
          <strong>{isEditing ? `Editar ${config.singular}` : `Novo ${config.singular}`}</strong>
        </div>

        <div className="form-grid">
          {visibleFields.map((field) => (
            <label key={field.name} className="field">
              <span>{field.label}</span>
              {renderField(field)}
            </label>
          ))}
        </div>

        <div className="actions-row">
          <button className="primary-button" type="submit" disabled={saving} title="Salvar">
            <Save size={18} />
            {saving ? "Salvando" : "Salvar"}
          </button>
          <button className="secondary-button" type="button" onClick={resetForm} title="Limpar">
            <RotateCcw size={18} />
            Limpar
          </button>
        </div>
      </form>

      <div className="table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={filters.busca}
              onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))}
              placeholder="Buscar"
            />
          </label>

          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            title="Filtrar por status"
          >
            <option value="">Todos</option>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td className="empty-cell" colSpan={config.columns.length + 1}>
                    {loading ? "Carregando registros" : "Nenhum registro encontrado"}
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    {config.columns.map((column) => (
                      <td key={column.key}>{readValue(record, column)}</td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-button" onClick={() => handleEdit(record)} title="Editar">
                          <Edit3 size={17} />
                        </button>
                        {config.teamManager ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setSelectedRecord(record)}
                            title="Equipe"
                          >
                            <UsersRound size={17} />
                          </button>
                        ) : null}
                        {config.financeManager ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setSelectedRecord(record)}
                            title="Financeiro"
                          >
                            <WalletCards size={17} />
                          </button>
                        ) : null}
                        <button type="button" className="icon-button danger" onClick={() => handleInactivate(record)} title="Inativar">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {config.teamManager && selectedRecord ? (
        <ProjectTeamManager
          project={selectedRecord}
          onChanged={loadRecords}
          onClose={() => setSelectedRecord(null)}
        />
      ) : null}

      {config.financeManager && selectedRecord ? (
        <CollaboratorFinanceManager
          collaborator={selectedRecord}
          onChanged={loadRecords}
          onClose={() => setSelectedRecord(null)}
        />
      ) : null}
    </section>
  );
}
