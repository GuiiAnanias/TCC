import { z } from "zod";

export const novaSenhaSchema = z
  .string({ message: "Informe a nova senha." })
  .min(8, "A nova senha precisa ter pelo menos 8 caracteres.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "A nova senha pode ter no máximo 72 bytes UTF-8; acentos e emojis ocupam mais de um byte.",
  );
