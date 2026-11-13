/**
 * [ERRO] Erro com status HTTP. Os services lançam, por exemplo, new HttpError(409, "Já existe um
 * cliente com este CNPJ.") e o errorHandler responde com esse status e mensagem.
 */

export class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
