/**
 * [SERVICE][API-EXTERNA] Consulta de CNPJ na ReceitaWS para preencher o cadastro. Tempo limite de
 * 12 s, cache de 10 minutos e uma mensagem para cada falha (limite de consultas, não encontrado,
 * indisponível); nada é gravado.
 */

import { cnpjSchema } from "../schemas/clientesSchemas.js";
import { HttpError } from "../utils/HttpError.js";

const cache = new Map();
const optionalText = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

// [VALIDACAO][ERRO] Confere o CNPJ antes de consultar e trata cada resposta da ReceitaWS.
export async function consultarCnpj(input) {
  const cnpj = cnpjSchema.parse(input);
  const cached = cache.get(cnpj);
  if (cached && cached.expires > Date.now()) return cached.data;
  let response;
  let data;
  try {
    response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (response.status === 429)
      throw new HttpError(
        429,
        "Limite de consultas de CNPJ atingido. Aguarde um minuto ou preencha os dados manualmente.",
      );
    if (response.status === 404)
      throw new HttpError(404, "CNPJ não encontrado. Você pode preencher os dados manualmente.");
    if (!response.ok)
      throw new HttpError(
        502,
        "Consulta de CNPJ indisponível. Tente novamente ou preencha os dados manualmente.",
      );
    data = await response.json();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "Não foi possível consultar o CNPJ. Tente novamente ou preencha os dados manualmente.",
    );
  }
  if (data?.status === "ERROR")
    throw new HttpError(
      404,
      "CNPJ não encontrado na consulta. Confira o CNPJ ou preencha os dados manualmente.",
    );
  if (data?.status !== "OK" || !optionalText(data.nome))
    throw new HttpError(
      502,
      "O serviço de CNPJ retornou dados inválidos. Preencha os dados manualmente.",
    );
  const cep = typeof data.cep === "string" ? data.cep.replace(/\D/g, "") : "";
  const email = optionalText(data.email);
  const result = {
    cnpj,
    nome: data.nome.trim(),
    nomeFantasia: optionalText(data.fantasia),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    telefone: optionalText(data.telefone),
    cep: /^\d{8}$/.test(cep) ? cep : null,
    logradouro: optionalText(data.logradouro),
    numero: optionalText(data.numero),
    complemento: optionalText(data.complemento),
    bairro: optionalText(data.bairro),
    cidade: optionalText(data.municipio),
    estado: optionalText(data.uf),
    situacaoCadastral: optionalText(data.situacao),
    abertura: optionalText(data.abertura),
    porte: optionalText(data.porte),
    naturezaJuridica: optionalText(data.natureza_juridica),
    atividadePrincipal: optionalText(data.atividade_principal?.[0]?.text),
  };
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(cnpj, { expires: Date.now() + 10 * 60 * 1000, data: result });
  return result;
}
