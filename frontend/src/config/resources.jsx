import React from "react";
import { BriefcaseBusiness, Building2, UsersRound, WalletCards, Clock } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

const statusOptions = [
  { label: "Ativo", value: "ATIVO" },
  { label: "Inativo", value: "INATIVO" }
];

const tipoBonificacaoOptions = [
  { label: "Nenhuma", value: "NENHUMA" },
  { label: "Valor fixo", value: "VALOR_FIXO" },
  { label: "Percentual", value: "PERCENTUAL" }
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

  return `${activeConfig.itemTabela.nivel} - ${currency(activeConfig.itemTabela.valorHora)}/h`;
}

export const resources = [
  {
    key: "clientes",
    title: "Clientes",
    singular: "cliente",
    endpoint: "/clientes",
    icon: Building2,
    fields: [
      { name: "nome", label: "Nome", type: "text", placeholder: "Nome do cliente", required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "ATIVO" }
    ],
    columns: [
      { key: "nome", label: "Nome" },
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
      { name: "nomeCompleto", label: "Nome completo", type: "text", placeholder: "Nome do colaborador", required: true },
      { name: "email", label: "E-mail", type: "email", placeholder: "email@empresa.com", required: true },
      { name: "cargo", label: "Cargo/Função", type: "text", placeholder: "Desenvolvedor", required: true },
      { name: "departamento", label: "Departamento", type: "text", placeholder: "Tecnologia", required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "ATIVO" }
    ],
    columns: [
      { key: "nomeCompleto", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "cargo", label: "Cargo/Função" },
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
      { name: "nivel", label: "Nível/Faixa", type: "text", placeholder: "Junior", required: true },
      { name: "valorHora", label: "Valor hora", type: "number", step: "0.01", min: "0", required: true },
      { name: "bonificacao", label: "Bonificação", type: "number", step: "0.01", min: "0", defaultValue: 0 },
      { name: "tipoBonificacao", label: "Tipo de bonificação", type: "select", options: tipoBonificacaoOptions, defaultValue: "NENHUMA" },
      { name: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "ATIVO" }
    ],
    columns: [
      { key: "nivel", label: "Nível/Faixa" },
      { key: "valorHora", label: "Valor hora", render: (item) => currency(item.valorHora) },
      { key: "bonificacao", label: "Bonificação", render: (item) => decimal(item.bonificacao) },
      { key: "tipoBonificacao", label: "Tipo" },
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
      { name: 'status', label: 'Status', type: 'select', defaultValue: 'Pendente', options: [ { value: 'PENDENTE', label: 'Pendente' }, { value: 'APROVADO', label: 'Aprovado' }, { value: 'FATURADO', label: 'Faturado' },],},
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
