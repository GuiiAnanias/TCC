import { HelpDialog } from "../components/HelpDialog.jsx";
import { Link, useSearchParams } from "react-router-dom";
import React from "react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Building2,
  UserRound,
  Check,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Archive,
  UsersRound,
  WalletCards,
  X,
  BarChart3,
} from "lucide-react";
import { api } from "../api/client.js";
import { CollaboratorFinanceManager } from "../components/CollaboratorFinanceManager.jsx";
import { ProjectTeamManager } from "../components/ProjectTeamManager.jsx";
import { SearchableSelect } from "../components/SearchableSelect.jsx";
import { FloatingActions } from "../components/FloatingActions.jsx";
import { RoleBonusManager } from "../components/RoleBonusManager.jsx";
import { InitialProjectTeam } from "../components/InitialProjectTeam.jsx";

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

function buildPayload(fields, formData, isEditing, originalRecord) {
  return fields.reduce((payload, field) => {
    if (field.hiddenOnCreate && !isEditing) {
      return payload;
    }

    const value = formData[field.name];

    if (
      field.clearable &&
      isEditing &&
      (value === "" || value === null) &&
      originalRecord?.[field.name]
    ) {
      payload[field.name] = null;
      return payload;
    }

    if (value !== "" && value !== null && value !== undefined) {
      if (isEditing && originalRecord) {
        const previous =
          field.type === "date"
            ? toInputDate(originalRecord[field.name])
            : originalRecord[field.name];
        if (String(value) === String(previous ?? "")) return payload;
      }
      payload[field.name] = value;
    }

    return payload;
  }, {});
}

export function CrudPage({ config }) {
  const isClient = config.key === "clientes";
  const [query] = useSearchParams();
  const handledNavigation = useRef("");
  const detailRegion = useRef(null);
  const [clientKind, setClientKind] = useState("PJ");
  const [formOpen, setFormOpen] = useState(false);
  const clientDrafts = useRef({});
  const formRegion = useRef(null);
  const formFields = useMemo(
    () => (isClient && clientKind === "PF" ? config.personFields(config.fields) : config.fields),
    [config, isClient, clientKind],
  );
  const formSections =
    isClient && clientKind === "PF"
      ? ["Dados pessoais", "Contato", "Endereço"]
      : config.formSections;
  const [records, setRecords] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);
  const [taskLoadError, setTaskLoadError] = useState("");
  const [colaboradores, setColaboradores] = useState([]);
  const [catalog, setCatalog] = useState({ cargos: [], niveisRemuneracao: [], departamentos: [] });
  const [filters, setFilters] = useState({ busca: "", status: "" });
  const [formData, setFormData] = useState(() => getInitialForm(config.fields));
  const [editingId, setEditingId] = useState(null);
  const [originalRecord, setOriginalRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [initialTeam, setInitialTeam] = useState([]);
  const [consultingCnpj, setConsultingCnpj] = useState(false);
  const [consultingCep, setConsultingCep] = useState(false);
  const [cepFeedback, setCepFeedback] = useState("");
  const cepRequest = useRef(null);
  const cnpjRequest = useRef(null);
  useEffect(
    () => () => {
      cnpjRequest.current?.abort();
      cepRequest.current?.abort();
    },
    [config],
  );

  const isEditing = Boolean(editingId);

  useEffect(() => {
    setTarefas([]);
    setTaskLoadError("");
    if (config.key !== "apontamentos" || !formData.projetoId) {
      setLoadingTarefas(false);
      return;
    }
    const controller = new AbortController();
    setLoadingTarefas(true);
    api
      .get("/tarefas", { params: { projetoId: formData.projetoId }, signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setTarefas(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setTaskLoadError(
            err.response?.data?.message ||
              "Não foi possível carregar as tarefas do projeto. Atualize a página para tentar novamente.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTarefas(false);
      });
    return () => controller.abort();
  }, [config.key, formData.projetoId]);

  const visibleFields = useMemo(
    () => formFields.filter((field) => !field.hiddenOnCreate || isEditing),
    [formFields, isEditing],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(config.endpoint, {
        params: {
          busca: filters.busca || undefined,
          status: filters.status || undefined,
        },
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
        params: { status: "ATIVO" },
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
        params: { status: "ATIVO" },
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
        params: { status: "ATIVO" },
      });
      setColaboradores(data);
    } catch {
      setColaboradores([]);
    }
  }, [config.loadColaboradores]);

  const loadCatalog = useCallback(async () => {
    if (!config.fields.some((field) => field.type === "catalog-select")) return;
    try {
      const { data } = await api.get("/opcoes-cadastro");
      setCatalog(data);
    } catch {
      setError("Não foi possível carregar as opções de cadastro.");
    }
  }, [config.fields]);

  useEffect(() => {
    setFormData(getInitialForm(config.fields));
    setFormOpen(false);
    setClientKind("PJ");
    clientDrafts.current = {};
    setEditingId(null);
    setOriginalRecord(null);
    setMessage("");
    setError("");
    setFilters({ busca: "", status: "" });
    setSelectedRecord(null);
    setInitialTeam([]);
    setConsultingCnpj(false);
    setConsultingCep(false);
    setCepFeedback("");
  }, [config]);

  useEffect(() => {
    loadRecords();
    loadClientes();
    loadProjetos();
    loadColaboradores();
    loadCatalog();
  }, [loadRecords, loadClientes, loadProjetos, loadColaboradores, loadCatalog]);

  function cancelCepLookup() {
    cepRequest.current?.abort();
    setConsultingCep(false);
    setCepFeedback("");
  }

  async function handleCepChange(value) {
    cancelCepLookup();
    const cep = value.replace(/\D/g, "");
    if (cep.length !== 8) return;
    const controller = new AbortController();
    cepRequest.current = controller;
    const previous = { ...formData };
    setConsultingCep(true);
    setCepFeedback("Consultando CEP…");
    try {
      const { data } = await api.get(`/clientes/cep/${cep}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setFormData((current) => {
        if (String(current.cep || "").replace(/\D/g, "") !== cep) return current;
        const next = { ...current };
        for (const name of ["logradouro", "bairro", "cidade", "estado"]) {
          // Preserve o que o usuário digitou enquanto a consulta estava em andamento.
          if (current[name] === previous[name]) next[name] = data[name] || "";
        }
        return next;
      });
      setCepFeedback("");
    } catch (requestError) {
      if (!controller.signal.aborted)
        setCepFeedback(
          requestError.response?.data?.message ||
            "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
        );
    } finally {
      if (cepRequest.current === controller && !controller.signal.aborted) setConsultingCep(false);
    }
  }

  function resetForm() {
    setInitialTeam([]);
    cancelCepLookup();
    cnpjRequest.current?.abort();
    setConsultingCnpj(false);
    setFormData(getInitialForm(formFields));
    setFormOpen(false);
    clientDrafts.current = {};
    setEditingId(null);
    setOriginalRecord(null);
    setMessage("");
    setError("");
  }

  function chooseClientKind(kind) {
    cancelCepLookup();
    cnpjRequest.current?.abort();
    setConsultingCnpj(false);
    if (formOpen && !isEditing) clientDrafts.current[clientKind] = formData;
    const fields = kind === "PF" ? config.personFields(config.fields) : config.fields;
    setFormData(clientDrafts.current[kind] || getInitialForm(fields));
    setClientKind(kind);
    setFormOpen(true);
    setEditingId(null);
    setOriginalRecord(null);
    setMessage("");
    setError("");
  }

  function handleEdit(record) {
    setInitialTeam([]);
    cancelCepLookup();
    cnpjRequest.current?.abort();
    setConsultingCnpj(false);
    const kind = record.tipoPessoa || "PJ";
    const fields = isClient && kind === "PF" ? config.personFields(config.fields) : config.fields;
    if (isClient) {
      setClientKind(kind);
      setFormOpen(true);
      clientDrafts.current = {};
      requestAnimationFrame(() =>
        formRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
    const nextForm = getInitialForm(fields, true);

    fields.forEach((field) => {
      if (field.type === "date") {
        nextForm[field.name] = toInputDate(record[field.name]);
        return;
      }

      const value = record[field.name] ?? field.defaultValue ?? "";
      nextForm[field.name] = field.format ? field.format(value) : value;
    });

    setFormData(nextForm);
    setEditingId(record.id);
    setOriginalRecord(record);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = buildPayload(formFields, formData, isEditing, originalRecord);

      if (isEditing && Object.keys(payload).length === 0) {
        setMessage("Nenhuma alteração para salvar.");
        return;
      }

      if (isClient && !isEditing) payload.tipoPessoa = clientKind;
      if (config.teamManager && !isEditing) payload.equipeInicial = initialTeam;

      if (isEditing) {
        await api.put(`${config.endpoint}/${editingId}`, payload);
      } else {
        await api.post(config.endpoint, payload);
      }

      resetForm();
      setMessage(`${config.singular} ${isEditing ? "atualizado" : "cadastrado"} com sucesso.`);
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

  async function handleCnpjLookup() {
    const cnpj = (formData.cnpj || "").toUpperCase().replace(/[./\-\s]/g, "");
    if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) {
      setError("Informe um CNPJ completo para consultar.");
      return;
    }
    const controller = new AbortController();
    cnpjRequest.current?.abort();
    cnpjRequest.current = controller;
    setConsultingCnpj(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.get(`/clientes/cnpj/${cnpj}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setFormData((current) => {
        const next = { ...current };
        config.fields.forEach((field) => {
          if (
            data[field.name] !== undefined &&
            data[field.name] !== null &&
            data[field.name] !== ""
          ) {
            next[field.name] = field.format ? field.format(data[field.name]) : data[field.name];
          }
        });
        return next;
      });
      setMessage("Dados da empresa preenchidos. Confira as informações antes de salvar.");
    } catch (requestError) {
      if (!controller.signal.aborted)
        setError(
          requestError.response?.data?.errors?.[0]?.message ||
            requestError.response?.data?.message ||
            "Não foi possível consultar o CNPJ. Preencha os dados manualmente.",
        );
    } finally {
      if (cnpjRequest.current === controller) setConsultingCnpj(false);
    }
  }

  async function handleInactivate(record) {
    const deleting = config.deleteMode === "delete";
    const confirmMessage = `${deleting ? "Excluir definitivamente" : config.inactivateLabel || "Inativar"} ${config.singular} "${record.nome || record.nomeCompleto || record.nivel || record.descricao}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`${config.endpoint}/${record.id}`);
      if (editingId === record.id) resetForm();
      setMessage(
        `${config.singular} ${deleting ? "excluído" : config.inactivatedLabel || "inativado"} com sucesso.`,
      );
      await loadRecords();
      await loadClientes();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível remover o registro.");
    }
  }

  function renderField(field) {
    const commonProps = {
      id: field.name,
      name: field.name,
      inputMode: field.inputMode,
      pattern: field.pattern,
      value: formData[field.name] ?? "",
      required: field.required || (field.requiredOnCreate && !isEditing),
      disabled: consultingCnpj || saving,
      onChange: (event) => {
        const raw = field.noNumbers
          ? event.target.value.replace(/\p{N}/gu, "")
          : event.target.value;
        const value = field.format ? field.format(raw) : raw;
        setFormData((current) => ({ ...current, [field.name]: value }));
        if (isClient && field.name === "cep") handleCepChange(value);
      },
    };

    if (field.name === "cnpj" && config.cnpjLookup) {
      return (
        <div className="cnpj-input-row">
          <input
            {...commonProps}
            type="text"
            maxLength={field.maxLength}
            placeholder={field.placeholder}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={handleCnpjLookup}
            disabled={consultingCnpj || saving}
            aria-label="Consultar CNPJ"
          >
            {consultingCnpj ? "Consultando…" : "Consultar CNPJ"}
          </button>
        </div>
      );
    }

    if (isClient && field.name === "cep") {
      return (
        <div className="cep-input">
          <input
            {...commonProps}
            type="text"
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            aria-describedby={cepFeedback ? "cep-feedback" : undefined}
            aria-busy={consultingCep}
          />
          {cepFeedback && (
            <small id="cep-feedback" className="field-help" role="status">
              {cepFeedback}
            </small>
          )}
        </div>
      );
    }

    if (field.type === "catalog-select") {
      const options = catalog[field.catalog] || [];
      const original = isEditing ? String(originalRecord?.[field.name] ?? "") : "";
      const legacy = original && !options.includes(original) ? [original] : [];
      return (
        <select
          {...commonProps}
          disabled={commonProps.disabled || (options.length === 0 && !legacy.length)}
        >
          <option value="">Selecione...</option>
          {legacy.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

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
        label: cliente.nome,
      }));

      return (
        <SearchableSelect
          id={field.name}
          name={field.name}
          options={clienteOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) =>
            setFormData((current) => ({ ...current, [field.name]: event.target.value }))
          }
          placeholder="Buscar cliente..."
          required={field.required}
          disabled={saving}
        />
      );
    }

    if (field.type === "projeto") {
      const projetoOptions = projetos.map((projeto) => ({
        value: String(projeto.id),
        label: projeto.nome,
      }));
      if (
        originalRecord?.projetoId &&
        !projetoOptions.some((option) => option.value === String(originalRecord.projetoId))
      )
        projetoOptions.push({
          value: String(originalRecord.projetoId),
          label: originalRecord.projeto?.nome || "Projeto do registro",
        });

      return (
        <SearchableSelect
          id={field.name}
          name={field.name}
          options={projetoOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) =>
            setFormData((current) => ({
              ...current,
              [field.name]: event.target.value,
              tarefaId: "",
            }))
          }
          placeholder="Buscar projeto..."
          required={field.required}
          disabled={saving}
        />
      );
    }

    if (field.type === "tarefa") {
      return (
        <select
          {...commonProps}
          disabled={saving || loadingTarefas || !formData.projetoId || Boolean(taskLoadError)}
        >
          <option value="">{loadingTarefas ? "Carregando tarefas…" : "Sem tarefa"}</option>
          {tarefas
            .filter(
              (task) => task.statusRegistro === "ATIVO" || task.id === originalRecord?.tarefaId,
            )
            .map((task) => (
              <option key={task.id} value={task.id}>
                {task.titulo}
                {task.statusRegistro === "INATIVO" ? " (arquivada)" : ""}
              </option>
            ))}
        </select>
      );
    }

    if (field.type === "colaborador") {
      const colaboradorOptions = colaboradores.map((colaborador) => ({
        value: String(colaborador.id),
        label: colaborador.nomeCompleto,
      }));
      if (
        originalRecord?.colaboradorId &&
        !colaboradorOptions.some((option) => option.value === String(originalRecord.colaboradorId))
      )
        colaboradorOptions.push({
          value: String(originalRecord.colaboradorId),
          label: originalRecord.colaborador?.nomeCompleto || "Colaborador do registro",
        });

      return (
        <SearchableSelect
          id={field.name}
          name={field.name}
          options={colaboradorOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) =>
            setFormData((current) => ({ ...current, [field.name]: event.target.value }))
          }
          placeholder="Buscar colaborador..."
          required={field.required}
          disabled={saving}
        />
      );
    }

    return (
      <input
        {...commonProps}
        type={field.type}
        maxLength={field.maxLength || (config.cnpjLookup ? 255 : undefined)}
        min={field.min}
        step={field.step}
        placeholder={field.placeholder}
      />
    );
  }

  useEffect(() => {
    const action = query.has("editar")
      ? "editar"
      : config.financeManager && query.has("financeiro")
        ? "financeiro"
        : config.teamManager && query.has("equipe")
          ? "equipe"
          : null;
    if (!action) return;
    const target = query.get(action);
    const key = `${config.key}:${action}:${target}`;
    if (handledNavigation.current === key) return;
    const record = records.find((row) => String(row.id) === target);
    if (!record) return;
    handledNavigation.current = key;
    if (action === "editar") handleEdit(record);
    else {
      setSelectedRecord(record);
      requestAnimationFrame(() =>
        detailRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [records, query, config]);

  return (
    <section className="content-panel">
      <header className="page-header">
        <div>
          <span className="eyebrow">Cadastro</span>
          <div className="dashboard-title-row">
            <h1>{config.title}</h1>
            <HelpDialog title={`Ajuda — ${config.title}`}>
              {config.fields
                .filter((field) => field.help)
                .map((field) => (
                  <section key={field.name}>
                    <h3>{field.label}</h3>
                    <p>{field.help}</p>
                  </section>
                ))}
              {isClient && (
                <section>
                  <h3>Cadastro de clientes</h3>
                  <p>
                    Escolha Pessoa Física ou Pessoa Jurídica para abrir o cadastro. Para empresas,
                    informe o CNPJ e consulte para preencher os dados, ou preencha manualmente.
                    Confira os dados antes de salvar.
                  </p>
                  <p>
                    E-mail e telefone não podem se repetir entre pessoas físicas. Contatos sem
                    preenchimento continuam opcionais.
                  </p>
                </section>
              )}
              {config.financeManager && (
                <section>
                  <h3>Configuração financeira</h3>
                  <p>
                    Use a ação Financeiro na lista para definir o nível, valor/hora e benefícios de
                    cada colaborador. Cargo e papel no projeto são definidos separadamente. A ajuda
                    do painel financeiro explica as vigências e o histórico.
                  </p>
                </section>
              )}
              {config.teamManager && (
                <section>
                  <h3>Equipe do projeto</h3>
                  <p>
                    Na criação, selecione vários colaboradores e preencha papel e entrada. O projeto
                    pode ser salvo sem equipe para planejamento; novas horas exigem ao menos um
                    colaborador ativo com participação válida na data trabalhada.
                  </p>
                  <p>
                    Use a ação Equipe na lista para vincular colaboradores, definir o papel e as
                    datas de participação. A ajuda do painel de equipe explica as alterações de
                    papel.
                  </p>
                </section>
              )}
              {config.key === "remuneracoes" && (
                <section>
                  <h3>Bonificação por papel</h3>
                  <p>
                    Os percentuais são definidos na seção Bonificação por papel no projeto, que
                    possui sua própria ajuda.
                  </p>
                </section>
              )}
              {!isClient && (
                <section>
                  <h3>Cadastro e consulta</h3>
                  <p>
                    Preencha os campos e clique em Salvar. Use a busca e o filtro de status para
                    localizar registros; a ação Editar carrega os dados no formulário.
                  </p>
                </section>
              )}
            </HelpDialog>
          </div>
        </div>
        <FloatingActions onRefresh={loadRecords} loading={loading} />
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
        {taskLoadError && (
          <div className="feedback error" role="alert">
            {taskLoadError}
          </div>
        )}
      </div>

      {isClient && (
        <div
          className={`client-type-picker ${formOpen ? "is-open" : ""}`}
          aria-label="Tipo de cliente"
        >
          {[
            ["PF", "Pessoa Física", UserRound],
            ["PJ", "Pessoa Jurídica", Building2],
          ].map(([kind, label, Icon]) => (
            <button
              key={kind}
              type="button"
              className={`secondary-button client-type-button ${formOpen && clientKind === kind ? "is-selected" : ""}`}
              disabled={saving}
              aria-pressed={formOpen && clientKind === kind}
              aria-expanded={formOpen && clientKind === kind}
              aria-controls="client-form"
              onClick={() => chooseClientKind(kind)}
            >
              <Icon size={21} />
              <span>+ {label}</span>
            </button>
          ))}
        </div>
      )}
      <div
        ref={formRegion}
        id={isClient ? "client-form" : undefined}
        className={isClient ? `client-form-reveal ${formOpen ? "is-open" : ""}` : undefined}
        inert={isClient && !formOpen ? true : undefined}
        aria-hidden={isClient && !formOpen ? true : undefined}
      >
        <div className={isClient ? "client-form-inner" : undefined}>
          <form className="form-panel" onSubmit={handleSubmit}>
            <div className="form-title">
              <Plus size={18} />
              <strong>
                {isClient
                  ? `${isEditing ? "Editar" : "Cadastrar"} ${clientKind === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}`
                  : isEditing
                    ? `Editar ${config.singular}`
                    : `Novo ${config.singular}`}
              </strong>
            </div>

            {formSections ? (
              formSections.map((section) => (
                <fieldset
                  className="company-section"
                  key={section}
                  disabled={consultingCnpj || saving}
                >
                  <legend>{section}</legend>
                  <div className="form-grid">
                    {visibleFields
                      .filter((field) => field.section === section)
                      .map((field) => (
                        <div
                          key={field.name}
                          className={`field ${field.name === "cnpj" ? "field-wide" : ""}`}
                        >
                          <label htmlFor={field.name}>
                            <span>
                              {field.label}
                              {field.required || (field.requiredOnCreate && !isEditing) ? " *" : ""}
                            </span>
                          </label>
                          {renderField(field)}
                        </div>
                      ))}
                  </div>
                </fieldset>
              ))
            ) : (
              <div className="form-grid">
                {visibleFields.map((field) => (
                  <label key={field.name} className="field">
                    <span>{field.label}</span>
                    {renderField(field)}
                  </label>
                ))}
              </div>
            )}

            {config.teamManager &&
              (isEditing ? (
                <div className="initial-project-team">
                  <strong>Equipe vinculada</strong>
                  <p>
                    Alterar os dados do projeto preserva a equipe existente. Entradas, saídas e
                    mudanças de papel são registradas no gerenciamento de equipe.
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() => setSelectedRecord(originalRecord)}
                  >
                    Gerenciar equipe do projeto
                  </button>
                </div>
              ) : (
                <InitialProjectTeam
                  members={initialTeam}
                  onChange={setInitialTeam}
                  projectStart={formData.dataInicio}
                  disabled={saving}
                />
              ))}
            <div className="actions-row">
              <button
                className="primary-button"
                type="submit"
                disabled={
                  saving ||
                  consultingCnpj ||
                  consultingCep ||
                  loadingTarefas ||
                  Boolean(taskLoadError)
                }
                title="Salvar"
              >
                <Save size={18} />
                {saving ? "Salvando" : "Salvar"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={resetForm}
                disabled={saving}
                title={isClient ? "Cancelar cadastro" : "Limpar"}
              >
                <RotateCcw size={18} />
                {isClient ? "Cancelar" : "Limpar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={filters.busca}
              onChange={(event) =>
                setFilters((current) => ({ ...current, busca: event.target.value }))
              }
              placeholder="Buscar"
            />
          </label>

          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            title="Filtrar por status"
          >
            <option value="">Todos</option>
            {config.fields
              .find((field) => field.name === "status")
              ?.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className={isClient ? "clients-table" : undefined}>
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
                        {(config.key === "projetos" || config.key === "colaboradores") && (
                          <Link
                            className="icon-button"
                            to={`/dashboard/${config.key}/${record.id}`}
                            title="Dashboard"
                            aria-label={`Dashboard de ${record.nome || record.nomeCompleto}`}
                          >
                            <BarChart3 size={17} />
                          </Link>
                        )}
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => handleEdit(record)}
                          title="Editar"
                        >
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
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => handleInactivate(record)}
                          title={
                            config.deleteMode === "delete"
                              ? "Excluir"
                              : config.inactivateLabel || "Inativar"
                          }
                          disabled={config.teamManager && record.status === "ENCERRADO"}
                        >
                          {config.teamManager ? <Archive size={17} /> : <Trash2 size={17} />}
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

      {config.key === "remuneracoes" && <RoleBonusManager />}
      <div ref={detailRegion}>
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
      </div>
    </section>
  );
}
