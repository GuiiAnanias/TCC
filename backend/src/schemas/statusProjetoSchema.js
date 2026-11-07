import { z } from "zod";

export const statusProjetoSchema = z.enum(["ATIVO", "PAUSADO", "ENCERRADO", "CANCELADO"], {
  message: "Selecione Ativo, Pausado, Encerrado ou Cancelado.",
});
