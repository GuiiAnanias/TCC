const bytes = (value) => new TextEncoder().encode(value).length;

// Mesmas regras do backend (backend/src/schemas/senhaSchemas.js). As quatro primeiras
// aparecem no checklist da tela; o limite de bytes só aparece quando é ultrapassado.
export const passwordRules = [
  {
    key: "tamanho",
    label: "Pelo menos 8 caracteres",
    test: (value) => value.length >= 8,
    error: "A nova senha precisa ter pelo menos 8 caracteres.",
  },
  {
    key: "maiuscula",
    label: "Uma letra maiúscula",
    test: (value) => /\p{Lu}/u.test(value),
    error: "A nova senha precisa ter ao menos uma letra maiúscula.",
  },
  {
    key: "numero",
    label: "Um número",
    test: (value) => /\p{Nd}/u.test(value),
    error: "A nova senha precisa ter ao menos um número.",
  },
  {
    key: "simbolo",
    label: "Um símbolo, como ! @ # $ %",
    test: (value) => /[^\p{L}\p{N}\s]/u.test(value),
    error: "A nova senha precisa ter ao menos um símbolo, como ! @ # $ %.",
  },
];

const byteLimit = {
  test: (value) => bytes(value) <= 72,
  error: "A nova senha pode ter no máximo 72 bytes UTF-8; acentos e emojis ocupam mais de um byte.",
};

export function newPasswordError(value) {
  return [...passwordRules, byteLimit].find((rule) => !rule.test(value))?.error || "";
}

export const passwordTooLong = (value) => !byteLimit.test(value);
