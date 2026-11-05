export function newPasswordError(value) {
  if (value.length < 8) return "A nova senha precisa ter pelo menos 8 caracteres.";
  if (new TextEncoder().encode(value).length > 72)
    return "A nova senha pode ter no máximo 72 bytes UTF-8; acentos e emojis ocupam mais de um byte.";
  return "";
}
