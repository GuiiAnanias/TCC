import { HttpError } from "./HttpError.js";

export function parseId(value, entityName = "registro") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Identificador de ${entityName} inválido.`);
  }

  return id;
}
