/**
 * [ERRO] Erro com status HTTP. Os services lançam, por exemplo, new ErroHttp(409, "Já existe um
 * cliente com este CNPJ.") e o tratarErros responde com esse status e mensagem.
 */

export class ErroHttp extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "ErroHttp";
    this.statusCode = statusCode;
    this.details = details;
  }
}
