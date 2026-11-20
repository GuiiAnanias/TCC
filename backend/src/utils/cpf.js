/**
 * [VALIDACAO] CPF: limpa a pontuação e confere os dois dígitos verificadores.
 */

// Remove pontos, traço e espaços.
export function normalizeCpf(value) {
  return value.replace(/[.\-\s]/g, "");
}

// [VALIDACAO] Recusa sequências repetidas (111.111.111-11) e confere os dígitos verificadores.
export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length++) {
    const sum = [...cpf.slice(0, length)].reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    );
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(cpf[length])) return false;
  }
  return true;
}
