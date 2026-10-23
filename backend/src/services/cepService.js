import { HttpError } from "../utils/HttpError.js";

const cache = new Map();
const clean = (value) => typeof value === "string" ? value.trim() : "";

export async function consultarCep(input) {
  const cep = String(input).replace(/[\s.\-]/g, "");
  if (!/^\d{8}$/.test(cep)) throw new HttpError(400, "Informe um CEP com 8 dígitos.");
  const cached = cache.get(cep);
  if (cached && cached.expires > Date.now()) return cached.data;
  let data;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new HttpError(502, "Consulta de CEP indisponível. Preencha o endereço manualmente.");
    data = await response.json();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Não foi possível consultar o CEP. Preencha o endereço manualmente.");
  }
  if (data?.erro) throw new HttpError(404, "CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.");
  if (!clean(data?.localidade) || !/^[A-Z]{2}$/.test(clean(data?.uf))) throw new HttpError(502, "A consulta retornou dados inválidos. Preencha o endereço manualmente.");
  const result = { cep, logradouro: clean(data.logradouro), bairro: clean(data.bairro), cidade: clean(data.localidade), estado: clean(data.uf) };
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(cep, { data: result, expires: Date.now() + 10 * 60 * 1000 });
  return result;
}
