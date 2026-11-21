/**
 * Máscaras de exibição: CNPJ, CPF, CEP e telefone, enquanto o usuário digita e nas tabelas.
 */

export function formatCnpj(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14)
    .replace(/^(.{2})(.)/, "$1.$2")
    .replace(/^(.{2})\.(.{3})(.)/, "$1.$2.$3")
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, "$1.$2.$3/$4")
    .replace(/\/(.{4})(.)/, "/$1-$2");
}
export function formatCep(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}
export function formatCpf(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function formatTelefone(value) {
  const digits = String(value || "")
    .split(/[/\n]/)[0]
    .replace(/\D/g, "")
    .slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const local = digits.slice(2);
  const split = digits.length > 10 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? `-${local.slice(split)}` : ""}`;
}

export function formatMoeda(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 10);
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return amount
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    .replace(/\u00a0/g, " ");
}

export function formatMoedaValor(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(num)) return formatMoeda(value);
  return num
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    .replace(/\u00a0/g, " ");
}

export function parseMoeda(value) {
  if (typeof value === "number") return value;
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits) / 100;
}

export function formatHoras(value) {
  const raw = String(value ?? "");
  let digits = raw.replace(/\D/g, "").slice(0, 8);
  if (/\d,\d{2}\s$/.test(raw)) {
    digits = digits.slice(0, -1);
  }
  if (!digits) return "";
  const amount = Number(digits) / 100;
  const formatted = amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} h`;
}

export function formatHorasValor(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(num)) return formatHoras(value);
  const formatted = num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} h`;
}

export function parseHoras(value) {
  if (typeof value === "number") return value;
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits) / 100;
}
