/**
 * [SEGURANCA] Texto do tempo de espera quando o login fica bloqueado por tentativas:
 * "10 segundos", "1 minuto", "4 minutos e 30 segundos".
 */

export function tempoDeEspera(segundos) {
  const plural = (n, palavra) => `${n} ${palavra}${n === 1 ? "" : "s"}`;
  if (segundos < 60) return plural(segundos, "segundo");
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto
    ? `${plural(minutos, "minuto")} e ${plural(resto, "segundo")}`
    : plural(minutos, "minuto");
}

// Segundos que faltam até o horário de liberação (arredondado para cima, nunca negativo).
export function segundosRestantes(liberaEm, agora = Date.now()) {
  return Math.max(0, Math.ceil((liberaEm - agora) / 1000));
}
