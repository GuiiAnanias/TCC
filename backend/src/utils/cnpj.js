export function normalizeCnpj(value) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[./\-\s]/g, "");
}

export function isValidCnpj(value) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (base) => {
    let weight = base.length - 7;
    const total = [...base].reduce((sum, character) => {
      const result = sum + (character.charCodeAt(0) - 48) * weight;
      weight = weight === 2 ? 9 : weight - 1;
      return result;
    }, 0);
    const remainder = total % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  };
  const first = digit(value.slice(0, 12));
  return value.slice(-2) === first + digit(value.slice(0, 12) + first);
}
