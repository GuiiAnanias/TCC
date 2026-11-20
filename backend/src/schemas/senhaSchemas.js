/**
 * [SCHEMA][VALIDACAO][SEGURANCA] Regras de senha forte (mínimo de 8 caracteres, letra maiúscula,
 * número e símbolo). Usadas na redefinição de senha e mostradas na tela pelo RequisitosSenha.
 */

import { z } from "zod";

// Regras para novas senhas, na ordem em que são conferidas. Senhas já cadastradas
// continuam entrando normalmente; as regras valem ao definir uma senha nova.
// O frontend repete as mesmas regras em src/autenticacao/senha.js para o checklist da tela.
export const regrasSenha = [
  {
    teste: (value) => value.length >= 8,
    mensagem: "A nova senha precisa ter pelo menos 8 caracteres.",
  },
  {
    teste: (value) => /\p{Lu}/u.test(value),
    mensagem: "A nova senha precisa ter ao menos uma letra maiúscula.",
  },
  {
    teste: (value) => /\p{Nd}/u.test(value),
    mensagem: "A nova senha precisa ter ao menos um número.",
  },
  {
    teste: (value) => /[^\p{L}\p{N}\s]/u.test(value),
    mensagem: "A nova senha precisa ter ao menos um símbolo, como ! @ # $ %.",
  },
  {
    teste: (value) => Buffer.byteLength(value, "utf8") <= 72,
    mensagem:
      "A nova senha pode ter no máximo 72 bytes UTF-8; acentos e emojis ocupam mais de um byte.",
  },
];

export const novaSenhaSchema = regrasSenha.reduce(
  (schema, regra) => schema.refine(regra.teste, regra.mensagem),
  z.string({ message: "Informe a nova senha." }),
);
