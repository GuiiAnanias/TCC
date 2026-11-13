/**
 * Datas financeiras sempre como dia (AAAA-MM-DD) em UTC, para vigências e apontamentos não mudarem
 * de dia por causa do fuso horário.
 */

export const financeDay = (value) => new Date(value).toISOString().slice(0, 10);
export const financeDate = (value) => new Date(`${financeDay(value)}T00:00:00.000Z`);
export const previousFinanceDay = (value) => new Date(financeDate(value).getTime() - 86400000);
export const todayFinanceDate = () =>
  new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())}T00:00:00.000Z`,
  );
