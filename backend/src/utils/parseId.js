/**
 * [VALIDACAO] Converte o :id da URL em número. Id que não seja inteiro positivo responde 400 (ex.:
 * "Identificador de cliente inválido.").
 */

import { HttpError } from "./HttpError.js";

export function parseId(value, entityName = "registro") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Identificador de ${entityName} inválido.`);
  }

  return id;
}
