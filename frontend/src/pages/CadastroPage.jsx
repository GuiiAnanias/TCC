/**
 * [TELA] Tela genérica de cadastro, usada por Clientes, Colaboradores, Remuneração, Projetos e
 * Apontamento de Horas. O que muda entre elas (endpoint, campos, colunas) vem de
 * config/cadastros.jsx. Formulário de cadastro/edição no topo e tabela com busca e filtro embaixo.
 */

import { DialogoExclusaoProjeto } from "../components/projetos/DialogoExclusaoProjeto.jsx";
import { DialogoAjuda } from "../components/comum/DialogoAjuda.jsx";
import { DialogoConfirmacao } from "../components/comum/DialogoConfirmacao.jsx";
import { PaginacaoTabela, usePaginacao } from "../components/comum/PaginacaoTabela.jsx";
import { HistoricoApontamentos } from "../components/apontamentos/HistoricoApontamentos.jsx";
import { Link, useSearchParams } from "react-router-dom";
import React from "react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Building2,
  UserRound,
  Check,
  Clock3,
  Edit3,
  History,
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
import { api } from "../api/conexao.js";
import { FinanceiroColaborador } from "../components/financeiro/FinanceiroColaborador.jsx";
import { EquipeProjeto } from "../components/projetos/EquipeProjeto.jsx";
import { SelecaoComBusca } from "../components/comum/SelecaoComBusca.jsx";
import { AcoesPagina } from "../components/comum/AcoesPagina.jsx";
import { BonificacaoPapeis } from "../components/financeiro/BonificacaoPapeis.jsx";
import { useValorMaisRecente, useEscopoRequisicao } from "../hooks/useEscopoRequisicao.js";
import { EquipeInicialProjeto } from "../components/projetos/EquipeInicialProjeto.jsx";

// Formulário vazio a partir da lista de campos do cadastro.
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

// [REQUISICAO] Monta o corpo enviado à API: converte números e datas e, na edição, manda só os
// campos alterados.
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

// [TELA] Componente da tela; config = item de cadastros.jsx do cadastro aberto.
export function CadastroPage({ config }) {
  const requestScope = useEscopoRequisicao(config);
  const [deletingProject, setDeletingProject] = useState(null);
  const [confirmingRecord, setConfirmingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("lancamentos");
  const [historyVersion, setHistoryVersion] = useState(0);
  const isClient = config.key === "clientes";
  const isApontamentos = config.key === "apontamentos";
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
  const paginacaoRegistros = usePaginacao(records);
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);
  const [taskLoadError, setTaskLoadError] = useState("");
  const [taskLoadVersion, setTaskLoadVersion] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);
  const [catalog, setCatalog] = useState({ cargos: [], niveisRemuneracao: [], departamentos: [] });
  const [optionErrors, setOptionErrors] = useState({});
  const [loadingOptions, setLoadingOptions] = useState({});
  const [filters, setFilters] = useState({ busca: "", status: "" });
  const currentFilters = useValorMaisRecente(filters);
  const [formData, setFormData] = useState(() => getInitialForm(config.fields));
  const [editingId, setEditingId] = useState(null);
  const [originalRecord, setOriginalRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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
            err.response?.data?.message || "Não foi possível carregar as tarefas do projeto.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTarefas(false);
      });
    return () => controller.abort();
  }, [config.key, formData.projetoId, taskLoadVersion]);

  const visibleFields = useMemo(
    () => formFields.filter((field) => !field.hiddenOnCreate || isEditing),
    [formFields, isEditing],
  );

  // [REQUISICAO] GET da listagem (config.endpoint) com a busca e o filtro de status.
  const loadRecords = useCallback(async () => {
    const request = requestScope.begin("records");
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(config.endpoint, {
        signal: request.signal,
        params: {
          busca: currentFilters.current.busca || undefined,
          status: currentFilters.current.status || undefined,
        },
      });

      if (!request.isCurrent()) return;
      setRecords(data);
      setSelectedRecord((current) => {
        if (!current || (!config.teamManager && !config.financeManager)) {
          return current;
        }

        return data.find((record) => record.id === current.id) || null;
      });
    } catch (requestError) {
      if (request.isCurrent())
        setError(requestError.response?.data?.message || "Não foi possível carregar os dados.");
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [config.endpoint, config.teamManager, config.financeManager, currentFilters, requestScope]);

  // [REQUISICAO] Listas para os campos de seleção (clientes, projetos, colaboradores e opções de
  // cadastro).
  const loadClientes = useCallback(async () => {
    if (!config.loadClientes) {
      return;
    }

    const request = requestScope.begin("clientes");
    setLoadingOptions((current) => ({ ...current, clientes: true }));
    setOptionErrors((current) => ({ ...current, clientes: "" }));
    try {
      const { data } = await api.get("/clientes", {
        params: { status: "ATIVO" },
        signal: request.signal,
      });

      if (!request.isCurrent()) return;
      setClientes(data);
    } catch {
      if (!request.isCurrent()) return;
      setClientes([]);
      setOptionErrors((current) => ({
        ...current,
        clientes: "Não foi possível carregar os clientes.",
      }));
    } finally {
      if (request.isCurrent()) setLoadingOptions((current) => ({ ...current, clientes: false }));
    }
  }, [config.loadClientes, requestScope]);

  const loadProjetos = useCallback(async () => {
    if (!config.loadProjetos) {
      return;
    }

    const request = requestScope.begin("projetos");
    setLoadingOptions((current) => ({ ...current, projetos: true }));
    setOptionErrors((current) => ({ ...current, projetos: "" }));
    try {
      const { data } = await api.get("/projetos", {
        params: { status: "ATIVO" },
        signal: request.signal,
      });
      if (!request.isCurrent()) return;
      setProjetos(data);
    } catch {
      if (!request.isCurrent()) return;
      setProjetos([]);
      setOptionErrors((current) => ({
        ...current,
        projetos: "Não foi possível carregar os projetos.",
      }));
    } finally {
      if (request.isCurrent()) setLoadingOptions((current) => ({ ...current, projetos: false }));
    }
  }, [config.loadProjetos, requestScope]);

  const loadColaboradores = useCallback(async () => {
    if (!config.loadColaboradores) {
      return;
    }

    const request = requestScope.begin("colaboradores");
    setLoadingOptions((current) => ({ ...current, colaboradores: true }));
    setOptionErrors((current) => ({ ...current, colaboradores: "" }));
    try {
      const { data } = await api.get("/colaboradores", {
        params: { status: "ATIVO" },
        signal: request.signal,
      });
      if (!request.isCurrent()) return;
      setColaboradores(data);
    } catch {
      if (!request.isCurrent()) return;
      setColaboradores([]);
      setOptionErrors((current) => ({
        ...current,
        colaboradores: "Não foi possível carregar os colaboradores.",
      }));
    } finally {
      if (request.isCurrent())
        setLoadingOptions((current) => ({ ...current, colaboradores: false }));
    }
  }, [config.loadColaboradores, requestScope]);

  const loadCatalog = useCallback(async () => {
    if (!config.fields.some((field) => field.type === "catalog-select")) return;
    const request = requestScope.begin("catalog");
    setLoadingOptions((current) => ({ ...current, catalog: true }));
    setOptionErrors((current) => ({ ...current, catalog: "" }));
    try {
      const { data } = await api.get("/opcoes-cadastro", { signal: request.signal });
      if (!request.isCurrent()) return;
      setCatalog(data);
    } catch {
      if (!request.isCurrent()) return;
      setOptionErrors((current) => ({
        ...current,
        catalog: "Não foi possível carregar as opções de cadastro.",
      }));
    } finally {
      if (request.isCurrent()) setLoadingOptions((current) => ({ ...current, catalog: false }));
    }
  }, [config.fields, requestScope]);

  useEffect(() => {
    setFormData(getInitialForm(config.fields));
    setFormOpen(false);
    setClientKind("PJ");
    clientDrafts.current = {};
    setEditingId(null);
    setOriginalRecord(null);
    setFieldErrors({});
    setMessage("");
    setError("");
    setFilters({ busca: "", status: "" });
    setDeletingProject(null);
    setConfirmingRecord(null);
    setActiveTab("lancamentos");
    setHistoryVersion(0);
    setSelectedRecord(null);
    setSaving(false);
    setRecords([]);
    setClientes([]);
    setProjetos([]);
    setColaboradores([]);
    setCatalog({ cargos: [], niveisRemuneracao: [], departamentos: [] });
    setInitialTeam([]);
    setConsultingCnpj(false);
    setConsultingCep(false);
    setCepFeedback("");
    setOptionErrors({});
    setLoadingOptions({});
  }, [config]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords, filters.busca, filters.status]);

  useEffect(() => {
    loadClientes();
    loadProjetos();
    loadColaboradores();
    loadCatalog();
  }, [loadClientes, loadProjetos, loadColaboradores, loadCatalog]);

  function cancelCepLookup() {
    cepRequest.current?.abort();
    setConsultingCep(false);
    setCepFeedback("");
  }

  // [API-EXTERNA] Ao completar o CEP, busca o endereço (GET /clientes/cep/:cep) e preenche o
  // formulário.
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
    requestScope.cancel("mutation");
    setSaving(false);
    setInitialTeam([]);
    cancelCepLookup();
    cnpjRequest.current?.abort();
    setConsultingCnpj(false);
    setFormData(getInitialForm(formFields));
    setFormOpen(false);
    clientDrafts.current = {};
    setEditingId(null);
    setOriginalRecord(null);
    setFieldErrors({});
    setMessage("");
    setError("");
  }

  function chooseClientKind(kind) {
    requestScope.cancel("mutation");
    setSaving(false);
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
    setFieldErrors({});
    setMessage("");
    setError("");
  }

  // [TELA] Abre o painel inferior (Financeiro ou Equipe) e ancora a rolagem até ele.
  function openDetailSection(record) {
    setSelectedRecord(record);
    requestAnimationFrame(() =>
      detailRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  // [TELA] Abre o registro no formulário para edição e ancora o usuário no topo do formulário.
  function handleEdit(record) {
    requestScope.cancel("mutation");
    setSaving(false);
    setInitialTeam([]);
    cancelCepLookup();
    cnpjRequest.current?.abort();
    setConsultingCnpj(false);
    if (isApontamentos) {
      setActiveTab("lancamentos");
    }
    const kind = record.tipoPessoa || "PJ";
    const fields = isClient && kind === "PF" ? config.personFields(config.fields) : config.fields;
    if (isClient) {
      setClientKind(kind);
      setFormOpen(true);
      clientDrafts.current = {};
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
    setFieldErrors({});
    setMessage("");
    setError("");
    requestAnimationFrame(() =>
      formRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  // [VALIDACAO][REQUISICAO] Confere os campos obrigatórios, monta o payload e envia POST (novo) ou
  // PUT (edição). Erros de validação da API aparecem campo a campo; os demais, no topo.
  async function handleSubmit(event) {
    event.preventDefault();
    if (
      saving ||
      Object.values(loadingOptions).some(Boolean) ||
      Object.values(optionErrors).some(Boolean) ||
      loadingTarefas ||
      taskLoadError
    )
      return;
    const missing = {};
    for (const field of formFields) {
      if (
        (field.required || (field.requiredOnCreate && !isEditing)) &&
        ["cliente", "projeto", "colaborador", "catalog-select", "select"].includes(field.type) &&
        !String(formData[field.name] ?? "").trim()
      )
        missing[field.name] = `Selecione ${field.label.toLocaleLowerCase("pt-BR")}.`;
    }
    setFieldErrors(missing);
    if (Object.keys(missing).length) {
      setError("Confira os campos obrigatórios indicados no formulário.");
      document.getElementById(Object.keys(missing)[0])?.focus();
      return;
    }
    const request = requestScope.begin("mutation");
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

      if (!request.isCurrent()) return;
      if (isEditing && isApontamentos) {
        setHistoryVersion((value) => value + 1);
      }
      resetForm();
      setMessage(`${config.singular} ${isEditing ? "atualizado" : "cadastrado"} com sucesso.`);
      await loadRecords();
      await loadClientes();
    } catch (requestError) {
      if (!request.isCurrent()) return;
      const response = requestError.response?.data;
      const validationMessage = response?.errors?.[0]?.message;
      setError(validationMessage || response?.message || "Não foi possível salvar o registro.");
    } finally {
      if (request.isCurrent()) setSaving(false);
    }
  }

  // [API-EXTERNA] Consultar CNPJ (GET /clientes/cnpj/:cnpj) e preencher os dados da empresa.
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

  // [TELA] Solicita confirmação em modal antes de excluir/inativar.
  function handleInactivate(record) {
    setConfirmingRecord(record);
  }

  // [REQUISICAO] Excluir/Inativar/Ativar após confirmação no modal (DELETE ou PUT na API).
  async function executeInactivate() {
    const record = confirmingRecord;
    if (!record) return;
    setConfirmingRecord(null);
    const deleting = config.deleteMode === "delete";
    const reactivating = !deleting && !config.teamManager && record.status === "INATIVO";

    const request = requestScope.begin("mutation");
    setError("");
    setMessage("");

    try {
      if (reactivating) {
        await api.put(`${config.endpoint}/${record.id}`, { status: "ATIVO" });
      } else {
        await api.delete(`${config.endpoint}/${record.id}`);
      }
      if (!request.isCurrent()) return;
      if (editingId === record.id) resetForm();
      if (isApontamentos) {
        setHistoryVersion((value) => value + 1);
      }
      setMessage(
        `${config.singular} ${
          deleting ? "excluído" : reactivating ? "ativado" : config.inactivatedLabel || "inativado"
        } com sucesso.`,
      );
      await loadRecords();
      await loadClientes();
    } catch (requestError) {
      if (request.isCurrent())
        setError(
          requestError.response?.data?.message ||
            (reactivating
              ? "Não foi possível ativar o registro."
              : "Não foi possível remover o registro."),
        );
    }
  }

  // [TELA] Desenha cada tipo de campo (texto, número, data, seleção, CEP, CNPJ...).
  function renderField(field) {
    const commonProps = {
      id: field.name,
      name: field.name,
      inputMode: field.inputMode,
      pattern: field.pattern,
      value: formData[field.name] ?? "",
      required: field.required || (field.requiredOnCreate && !isEditing),
      "aria-invalid": Boolean(fieldErrors[field.name]),
      "aria-describedby": fieldErrors[field.name] ? `${field.name}-error` : undefined,
      disabled: consultingCnpj || saving,
      onChange: (event) => {
        const raw = field.noNumbers
          ? event.target.value.replace(/\p{N}/gu, "")
          : event.target.value;
        const value = field.format ? field.format(raw) : raw;
        setFieldErrors((current) => ({ ...current, [field.name]: "" }));
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
          disabled={
            commonProps.disabled ||
            loadingOptions.catalog ||
            Boolean(optionErrors.catalog) ||
            (options.length === 0 && !legacy.length)
          }
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
      const clienteOptions = clientes
        .filter((cliente) => cliente.status === "ATIVO")
        .map((cliente) => ({
          value: String(cliente.id),
          label: cliente.nome,
        }));
      if (
        originalRecord?.clienteId &&
        !clienteOptions.some((option) => option.value === String(originalRecord.clienteId))
      )
        clienteOptions.push({
          value: String(originalRecord.clienteId),
          label: `${originalRecord.cliente?.nome || "Cliente do projeto"}${originalRecord.cliente?.status === "INATIVO" ? " (inativo)" : " (vínculo atual)"}`,
        });

      return (
        <SelecaoComBusca
          id={field.name}
          name={field.name}
          options={clienteOptions}
          value={formData[field.name] ?? ""}
          onChange={commonProps.onChange}
          placeholder="Buscar cliente..."
          required={field.required}
          error={fieldErrors[field.name]}
          disabled={saving || loadingOptions.clientes || Boolean(optionErrors.clientes)}
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
        <SelecaoComBusca
          id={field.name}
          name={field.name}
          options={projetoOptions}
          value={formData[field.name] ?? ""}
          onChange={(event) => {
            commonProps.onChange(event);
            setFormData((current) => ({ ...current, tarefaId: "" }));
          }}
          placeholder="Buscar projeto..."
          required={field.required}
          error={fieldErrors[field.name]}
          disabled={saving || loadingOptions.projetos || Boolean(optionErrors.projetos)}
        />
      );
    }

    if (field.type === "tarefa") {
      const tarefaOptions = [
        { value: "", label: "Sem tarefa" },
        ...tarefas
          .filter((task) => task.statusRegistro === "ATIVO" || task.id === originalRecord?.tarefaId)
          .map((task) => ({
            value: String(task.id),
            label: `${task.titulo}${task.statusRegistro === "INATIVO" ? " (arquivada)" : ""}`,
          })),
      ];

      return (
        <SelecaoComBusca
          id={field.name}
          name={field.name}
          options={tarefaOptions}
          value={formData[field.name] ?? ""}
          onChange={commonProps.onChange}
          placeholder={loadingTarefas ? "Carregando tarefas…" : "Sem tarefa"}
          required={field.required}
          error={fieldErrors[field.name]}
          disabled={saving || loadingTarefas || !formData.projetoId || Boolean(taskLoadError)}
        />
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
        <SelecaoComBusca
          id={field.name}
          name={field.name}
          options={colaboradorOptions}
          value={formData[field.name] ?? ""}
          onChange={commonProps.onChange}
          placeholder="Buscar colaborador..."
          required={field.required}
          error={fieldErrors[field.name]}
          disabled={saving || loadingOptions.colaboradores || Boolean(optionErrors.colaboradores)}
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

  // Link vindo do Dashboard Geral com uma pendência: `?equipe=<projeto>&colaborador=<id>&data=`
  // ou `?financeiro=<colaborador>&data=`. Só vale para o registro que o link abriu.
  function pendenciaDoLink(acao, record) {
    const data = query.get("data");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "") || query.get(acao) !== String(record.id))
      return null;
    return { data, colaboradorId: acao === "equipe" ? query.get("colaborador") : record.id };
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
            <DialogoAjuda title={`Ajuda — ${config.title}`}>
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
                    Use a ação Financeiro na lista para definir o nível, valor/hora e benefícios
                    (informativos, fora do custo) de cada colaborador. Cargo e papel no projeto são
                    definidos separadamente. A ajuda do painel financeiro explica as vigências e o
                    histórico.
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
            </DialogoAjuda>
          </div>
        </div>
        <AcoesPagina
          onRefresh={() => {
            loadRecords();
            if (isApontamentos) setHistoryVersion((value) => value + 1);
          }}
          loading={loading}
        />
      </header>

      {isApontamentos && (
        <nav className="tasks-tabs" aria-label="Seções de apontamento de horas">
          <button
            type="button"
            className={activeTab === "lancamentos" ? "primary-button" : "secondary-button"}
            onClick={() => setActiveTab("lancamentos")}
          >
            <Clock3 size={16} aria-hidden="true" />
            Lançar horas
          </button>
          <button
            type="button"
            className={activeTab === "historico" ? "primary-button" : "secondary-button"}
            onClick={() => setActiveTab("historico")}
          >
            <History size={16} aria-hidden="true" />
            Histórico
          </button>
        </nav>
      )}

      <div className="feedback-row">
        {Object.entries(optionErrors)
          .filter(([, text]) => text)
          .map(([kind, text]) => (
            <div className="feedback error" role="alert" key={kind}>
              {text}
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  ({
                    clientes: loadClientes,
                    projetos: loadProjetos,
                    colaboradores: loadColaboradores,
                    catalog: loadCatalog,
                  })[kind]()
                }
              >
                Tentar novamente
              </button>
            </div>
          ))}
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
            <button type="button" onClick={() => setTaskLoadVersion((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {isApontamentos && activeTab === "historico" ? (
        <HistoricoApontamentos
          colaboradores={colaboradores}
          projetos={projetos}
          refreshSignal={historyVersion}
        />
      ) : (
        <>
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
                                  {field.required || (field.requiredOnCreate && !isEditing)
                                    ? " *"
                                    : ""}
                                </span>
                              </label>
                              {renderField(field)}
                              {fieldErrors[field.name] && (
                                <small id={`${field.name}-error`} role="alert">
                                  {fieldErrors[field.name]}
                                </small>
                              )}
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
                        {fieldErrors[field.name] && (
                          <small id={`${field.name}-error`} role="alert">
                            {fieldErrors[field.name]}
                          </small>
                        )}
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
                        onClick={() => openDetailSection(originalRecord)}
                      >
                        Gerenciar equipe do projeto
                      </button>
                    </div>
                  ) : (
                    <EquipeInicialProjeto
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
                      Object.values(loadingOptions).some(Boolean) ||
                      Object.values(optionErrors).some(Boolean) ||
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
                        {loading
                          ? "Carregando registros"
                          : filters.busca || filters.status
                            ? "Nenhum registro encontrado"
                            : (config.emptyMessage ?? "Nenhum registro encontrado")}
                      </td>
                    </tr>
                  ) : (
                    paginacaoRegistros.itensPaginados.map((record) => (
                      <tr key={record.id}>
                        {config.columns.map((column) => {
                          const content = readValue(record, column);
                          const textTitle =
                            typeof content === "string" || typeof content === "number"
                              ? String(content)
                              : undefined;
                          return (
                            <td key={column.key} title={textTitle}>
                              {content}
                            </td>
                          );
                        })}
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
                                onClick={() => openDetailSection(record)}
                                title="Equipe"
                              >
                                <UsersRound size={17} />
                              </button>
                            ) : null}
                            {config.financeManager ? (
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => openDetailSection(record)}
                                title="Financeiro"
                              >
                                <WalletCards size={17} />
                              </button>
                            ) : null}
                            {(() => {
                              const isDeleting = config.deleteMode === "delete";
                              const isReactivating =
                                !isDeleting && !config.teamManager && record.status === "INATIVO";
                              const actionLabel = isDeleting
                                ? "Excluir"
                                : isReactivating
                                  ? "Ativar"
                                  : config.inactivateLabel || "Inativar";
                              return (
                                <button
                                  type="button"
                                  className={`icon-button${isReactivating ? "" : " danger"}`}
                                  onClick={() => handleInactivate(record)}
                                  title={actionLabel}
                                  aria-label={`${actionLabel} ${record.nome || record.nomeCompleto || record.nivel || record.descricao || config.singular}`}
                                  disabled={config.teamManager && record.status === "ENCERRADO"}
                                >
                                  {config.teamManager ? (
                                    <Archive size={17} />
                                  ) : isReactivating ? (
                                    <RotateCcw size={17} />
                                  ) : (
                                    <Trash2 size={17} />
                                  )}
                                </button>
                              );
                            })()}
                            {config.key === "projetos" && (
                              <button
                                type="button"
                                className="icon-button danger"
                                title="Excluir definitivamente"
                                aria-label={`Excluir definitivamente o projeto ${record.nome}`}
                                onClick={() => setDeletingProject(record)}
                              >
                                <Trash2 size={17} />
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
              pagina={paginacaoRegistros.pagina}
              totalPaginas={paginacaoRegistros.totalPaginas}
              totalItens={paginacaoRegistros.totalItens}
              inicio={paginacaoRegistros.inicio}
              fim={paginacaoRegistros.fim}
              onPageChange={paginacaoRegistros.setPagina}
              rotulo={`Páginas de ${config.title}`}
            />
          </div>
        </>
      )}

      {confirmingRecord &&
        (() => {
          const isDeleting = config.deleteMode === "delete";
          const isReactivating =
            !isDeleting && !config.teamManager && confirmingRecord.status === "INATIVO";
          const actionVerb = isDeleting
            ? "Excluir"
            : isReactivating
              ? "Ativar"
              : config.inactivateLabel || "Inativar";
          const descriptionVerb = isDeleting ? "Excluir definitivamente" : actionVerb;
          return (
            <DialogoConfirmacao
              title={`${actionVerb} ${config.singular}`}
              description={`${descriptionVerb} ${config.singular} "${confirmingRecord.nome || confirmingRecord.nomeCompleto || confirmingRecord.nivel || confirmingRecord.descricao}"?`}
              confirmLabel={descriptionVerb}
              danger={isDeleting}
              onConfirm={executeInactivate}
              onCancel={() => setConfirmingRecord(null)}
            />
          );
        })()}

      {config.key === "remuneracoes" && <BonificacaoPapeis />}
      {config.key === "projetos" && deletingProject && (
        <DialogoExclusaoProjeto
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
          onDeleted={async (project) => {
            setDeletingProject(null);
            if (editingId === project.id) resetForm();
            if (selectedRecord?.id === project.id) setSelectedRecord(null);
            setError("");
            setMessage(`Projeto "${project.nome}" excluído definitivamente.`);
            await loadRecords();
          }}
        />
      )}
      <div ref={detailRegion}>
        {config.teamManager && selectedRecord ? (
          <EquipeProjeto
            key={selectedRecord.id}
            project={selectedRecord}
            onChanged={loadRecords}
            onClose={() => setSelectedRecord(null)}
            pendencia={pendenciaDoLink("equipe", selectedRecord)}
          />
        ) : null}

        {config.financeManager && selectedRecord ? (
          <FinanceiroColaborador
            key={selectedRecord.id}
            collaborator={selectedRecord}
            onChanged={loadRecords}
            onClose={() => setSelectedRecord(null)}
            pendencia={pendenciaDoLink("financeiro", selectedRecord)}
          />
        ) : null}
      </div>
    </section>
  );
}
