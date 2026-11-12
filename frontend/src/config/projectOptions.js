export const projectStatusOptions = [
  { value: "ATIVO", label: "Ativo" },
  { value: "PAUSADO", label: "Pausado" },
  { value: "ENCERRADO", label: "Encerrado" },
  { value: "CANCELADO", label: "Cancelado" },
];

export const projectContractOptions = [
  { value: "ESCOPO_FECHADO", label: "Escopo fechado" },
  { value: "POR_HORA", label: "Por hora" },
  { value: "FEE_MENSAL", label: "Fee mensal" },
  { value: "SQUAD", label: "Squad" },
];

export const projectStatusLabel = (status) =>
  projectStatusOptions.find((option) => option.value === status)?.label ?? status;

export const projectContractLabel = (type) =>
  projectContractOptions.find((option) => option.value === type)?.label ?? type;
