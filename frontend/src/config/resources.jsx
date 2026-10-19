import React from "react";
import { BriefcaseBusiness, Building2, UsersRound, WalletCards, Clock } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { formatCnpj, formatCep, formatCpf, formatTelefone } from "../utils/companyFormat.js";

const statusOptions = [
  { label: "Ativo", value: "ATIVO" },
  { label: "Inativo", value: "INATIVO" }
];

const tipoContratoOptions = [
  { label: "Fixo", value: "FIXO" },
  { label: "Horas", value: "HORAS" },
  { label: "Fechado", value: "FECHADO" }
];

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

function date(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function activeTeamCount(item) {
  return item._count?.equipe ?? item.equipe?.filter((member) => !member.dataSaida).length ?? 0;
}

function currentRemuneration(item) {
  const [activeConfig] = item.configuracoesFinanceiras || [];

  if (!activeConfig?.itemTabela) {
    return "-";
  }

  return `${activeConfig.nivelAplicado} - ${currency(activeConfig.valorHoraAplicado)}/h`;
}

export const resources = [
  {
    key: "clientes",
    title: "Clientes",
    singular: "cliente",
    endpoint: "/clientes",
    icon: Building2,
    cnpjLookup: true,
    formSections: ["Dados da empresa", "Contato", "Endereço", "Informações cadastrais"],
    personFields: (fields) => [
      { name: "cpf", label: "CPF", type: "text", placeholder: "000.000.000-00", required: true, format: formatCpf, maxLength: 14, section: "Dados pessoais" },
      ...fields.filter((field) => !["cnpj", "nomeFantasia", "contato"].includes(field.name) && field.section !== "Informações cadastrais").map((field) => field.name === "nome"
        ? { ...field, label: "Nome completo", placeholder: "Nome completo da pessoa", section: "Dados pessoais" }
        : field.name === "status" ? { ...field, section: "Dados pessoais" } : field)
    ],
    fields: [
      { name: "cnpj", label: "CNPJ", type: "text", placeholder: "00.000.000/0000-00", requiredOnCreate: true, format: formatCnpj, maxLength: 18, clearable: true, section: "Dados da empresa" },
      { name: "nome", label: "Razão social", type: "text", placeholder: "Razão social da empresa", required: true, maxLength: 255, section: "Dados da empresa" },
      { name: "nomeFantasia", label: "Nome fantasia", type: "text", clearable: true, section: "Dados da empresa" },
      { name: "status", label: "Status no sistema", type: "select", options: statusOptions, defaultValue: "ATIVO", section: "Dados da empresa" },
      { name: "contato", label: "Pessoa de contato", type: "text", clearable: true, section: "Contato" },
      { name: "email", label: "E-mail", type: "email", clearable: true, section: "Contato" },
      { name: "telefone", label: "Telefone", type: "tel", format: formatTelefone, maxLength: 15, inputMode: "numeric", pattern: "\\([1-9]\\d\\) \\d{4,5}-\\d{4}", placeholder: "(00) 00000-0000", clearable: true, section: "Contato" },
      { name: "cep", label: "CEP", type: "text", format: formatCep, inputMode: "numeric", maxLength: 9, placeholder: "00000-000", clearable: true, section: "Endereço" },
      { name: "logradouro", label: "Logradouro", type: "text", clearable: true, section: "Endereço" },
      { name: "numero", label: "Número", type: "text", maxLength: 30, clearable: true, section: "Endereço" },
      { name: "complemento", label: "Complemento", type: "text", clearable: true, section: "Endereço" },
      { name: "bairro", label: "Bairro", type: "text", clearable: true, section: "Endereço" },
      { name: "cidade", label: "Cidade", type: "text", maxLength: 150, clearable: true, section: "Endereço" },
      { name: "estado", label: "UF", type: "select", options: [{ label: "Selecione…", value: "" }, ..."AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ").map((uf) => ({ label: uf, value: uf }))], clearable: true, section: "Endereço" },
      { name: "situacaoCadastral", label: "Situação cadastral do CNPJ", type: "text", maxLength: 80, clearable: true, section: "Informações cadastrais" },
      { name: "abertura", label: "Data de abertura", type: "text", placeholder: "DD/MM/AAAA", maxLength: 30, clearable: true, section: "Informações cadastrais" },
      { name: "porte", label: "Porte", type: "text", maxLength: 100, clearable: true, section: "Informações cadastrais" },
      { name: "naturezaJuridica", label: "Natureza jurídica", type: "text", clearable: true, section: "Informações cadastrais" },
      { name: "atividadePrincipal", label: "Atividade principal", type: "text", clearable: true, section: "Informações cadastrais" }
    ],
    columns: [
      { key: "nome", label: "Cliente", render: (item) => <div className="company-name"><strong>{item.nome}</strong>{item.nomeFantasia && <small>{item.nomeFantasia}</small>}<small>{item.tipoPessoa === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</small></div> },
      { key: "documento", label: "CPF / CNPJ", render: (item) => item.tipoPessoa === "PF" ? formatCpf(item.cpf) || "Não informado" : item.cnpj ? formatCnpj(item.cnpj) : "Não informado" },
      { key: "cidade", label: "Cidade / UF", render: (item) => [item.cidade, item.estado].filter(Boolean).join(" / ") || "—" },
      { key: "contato", label: "Contato", render: (item) => <div className="company-contact">{item.contato && <span>{item.contato}</span>}<span>{item.email || "—"}</span>{item.telefone && <small>{formatTelefone(item.telefone)}</small>}</div> },
      { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> }
    ]
  },
  {
    key: "colaboradores",
    title: "Colaboradores",
    singular: "colaborador",
    endpoint: "/colaboradores",
    icon: UsersRound,
    financeManager: true,
    fields: [
      { name: "nomeCompleto", label: "Nome completo", type: "text", placeholder: "Nome do colaborador", required: true, noNumbers: true },
      { name: "email", label: "E-mail", type: "email", placeholder: "email@empresa.com", required: true },
      { name: "cargo", label: "Cargo", type: "catalog-select", catalog: "cargos", required: true, help: "Atuação profissional. A remuneração e o papel no projeto são definidos separadamente." },
      { name: "departamento", label: "Departamento", type: "catalog-select", catalog: "departamentos", required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "ATIVO" }
    ],
    columns: [
      { key: "nomeCompleto", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "cargo", label: "Cargo" },
      { key: "departamento", label: "Departamento" },
      { key: "configuracaoFinanceira", label: "Remuneração vigente", render: currentRemuneration },
      { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> }
    ]
  },
  {
    key: "remuneracoes",
    title: "Remuneração",
    singular: "item",
    endpoint: "/remuneracoes",
    icon: WalletCards,
    fields: [
      { name: "nivel", label: "Nível de remuneração", type: "catalog-select", catalog: "niveisRemuneracao", required: true, help: "Faixa de carreira, como Júnior II ou Pleno I. O valor/hora é informado abaixo." },
      { name: "valorHora", label: "Valor hora", type: "number", step: "0.01", min: "0.01", required: true, help: "Usado em novas vigências. Configurações financeiras existentes mantêm o valor/hora preservado." },
      { name: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "ATIVO" }
    ],
    columns: [
      { key: "nivel", label: "Nível de remuneração" },
      { key: "valorHora", label: "Valor hora", render: (item) => currency(item.valorHora) },
      { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> }
    ]
  },
  {
    key: "projetos",
    title: "Projetos",
    singular: "projeto",
    endpoint: "/projetos",
    icon: BriefcaseBusiness,
    loadClientes: true,
    teamManager: true,
    fields: [
      { name: "nome", label: "Nome do projeto", type: "text", placeholder: "Sistema de Indicadores", required: true },
      { name: "clienteId", label: "Cliente", type: "cliente", required: true },
      { name: "tipoContrato", label: "Tipo de contrato", type: "select", options: tipoContratoOptions, defaultValue: "FECHADO" },
      { name: "horasContratadas", label: "Horas contratadas", type: "number", step: "0.01", min: "0", required: true },
      { name: "valorProjeto", label: "Valor do projeto", type: "number", step: "0.01", min: "0", required: true },
      { name: "dataInicio", label: "Data de início", type: "date", required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "ATIVO", hiddenOnCreate: true }
    ],
    columns: [
      { key: "nome", label: "Projeto" },
      { key: "cliente", label: "Cliente", render: (item) => item.cliente?.nome || "-" },
      { key: "tipoContrato", label: "Contrato" },
      { key: "horasContratadas", label: "Horas", render: (item) => decimal(item.horasContratadas) },
      { key: "valorProjeto", label: "Valor", render: (item) => currency(item.valorProjeto) },
      {
        key: "equipe",
        label: "Equipe",
        render: (item) => {
          const total = activeTeamCount(item);
          return `${total} ativo${total === 1 ? "" : "s"}`;
        }
      },
      { key: "dataInicio", label: "Início", render: (item) => date(item.dataInicio) },
      { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> }
    ]
  },
  {
    key: "apontamentos",
    deleteMode: "delete",
    title: "Apontamento de Horas",
    singular: "apontamento",
    endpoint: "/apontamentos",
    icon: Clock,
    loadColaboradores: true,
    loadProjetos: true,
    fields: [
      { name: "colaboradorId", label: "Colaborador", type: "colaborador", required: true },
      { name: "projetoId", label: "Projeto", type: "projeto", required: true },
      { name: "data", label: "Data", type: "date", required: true },
      { name: "horas", label: "Horas trabalhadas", type: "number", step: "0.5", min: "0", required: true },
      { name: 'status', label: 'Status', type: 'select', defaultValue: 'PENDENTE', options: [ { value: 'PENDENTE', label: 'Pendente' }, { value: 'APROVADO', label: 'Aprovado' }, { value: 'FATURADO', label: 'Faturado' },],},
      { name: "descricao", label: "Descrição da atividade", type: "text", required: true }
    ],
    columns: [
      { key: "colaborador", label: "Colaborador", render: (item) => item.colaborador?.nomeCompleto || "-" },
      { key: "projeto", label: "Projeto", render: (item) => item.projeto?.nome || "-" },
      { key: "data", label: "Data", render: (item) => date(item.data) },
      { key: "horas", label: "Horas", render: (item) => decimal(item.horas) },
      { key: 'status', label: 'Status', render: (val) => (typeof val === 'string' ? val : val?.status || 'PENDENTE')},
      { key: "descricao", label: "Descrição" }
    ]
  }
];
