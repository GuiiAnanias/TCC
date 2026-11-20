/**
 * [SCHEMA][VALIDACAO] Status possíveis de um projeto: Ativo, Pausado, Encerrado e Cancelado.
 */

import { z } from "zod";

export const statusProjetoSchema = z.enum(["ATIVO", "PAUSADO", "ENCERRADO", "CANCELADO"], {
  message: "Selecione Ativo, Pausado, Encerrado ou Cancelado.",
});
