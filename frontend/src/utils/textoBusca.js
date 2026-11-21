// Busca por texto nas listas da tela: ignora maiúsculas, acentos e espaços nas pontas
// ("joao" encontra "João", "acao" encontra "Ação").

export function normalizarBusca(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/** Verdadeiro quando a busca está vazia ou aparece em algum dos textos. */
export function contemBusca(busca, ...textos) {
  const alvo = normalizarBusca(busca);
  if (!alvo) return true;
  return textos.some((texto) => normalizarBusca(texto).includes(alvo));
}
