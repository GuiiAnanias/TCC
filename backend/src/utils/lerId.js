/**
 * [VALIDACAO] Converte o :id da URL em número. Id que não seja inteiro positivo responde 400 (ex.:
 * "Identificador de cliente inválido.").
 */

import { ErroHttp } from "./ErroHttp.js";

export function lerId(value, entityName = "registro") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ErroHttp(400, `Identificador de ${entityName} inválido.`);
  }

  return id;
}
