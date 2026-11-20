/**
 * Data de hoje no fuso de São Paulo (AAAA-MM-DD), para limites como "data não pode ser futura"
 * baterem com o backend.
 */

const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayBusinessDate(now = new Date()) {
  const parts = Object.fromEntries(
    calendar.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const currentBusinessMonth = (now = new Date()) => todayBusinessDate(now).slice(0, 7);
