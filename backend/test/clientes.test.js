import { test } from "node:test";
import assert from "node:assert/strict";
import { clienteCreateSchema, clienteUpdateSchema } from "../src/schemas/clientesSchemas.js";
import { normalizeCnpj, isValidCnpj } from "../src/utils/cnpj.js";
import { consultarCnpj } from "../src/services/cnpjService.js";
import { clientesService } from "../src/services/clientesService.js";
import { clientesRepository } from "../src/repositories/clientesRepository.js";
import { isValidCpf } from "../src/utils/cpf.js";

test("individual validation requires CPF and rejects company data", () => {
  const data = clienteCreateSchema.parse({ tipoPessoa: "PF", nome: "Pessoa Exemplo", cpf: "529.982.247-25", email: "pessoa@example.com" });
  assert.equal(data.cpf, "52998224725");
  assert.equal(data.tipoPessoa, "PF");
  for (const cpf of ["11111111111", "00000000000", "52998224726", "529982247", "abc52998224725"]) assert.equal(isValidCpf(cpf), false);
  assert.equal(clienteCreateSchema.safeParse({ tipoPessoa: "PF", nome: "Pessoa" }).success, false);
  assert.equal(clienteCreateSchema.safeParse({ ...data, cnpj: "00000000000191" }).success, false);
  assert.equal(clienteCreateSchema.safeParse({ ...data, nomeFantasia: "Empresa" }).success, false);
  assert.equal(clienteCreateSchema.safeParse({ tipoPessoa: "PJ", nome: "Empresa", cnpj: "00000000000191", cpf: data.cpf }).success, false);
  assert.equal(clienteCreateSchema.parse({ nome: "Empresa", cnpj: "00000000000191" }).tipoPessoa, "PJ");
  assert.deepEqual(clienteUpdateSchema.parse({ cpf: "529.982.247-25" }), { cpf: "52998224725" });
});

test("individuals allow equal names but block duplicate CPF and wrong-type updates", async () => {
  const original = { ...clientesRepository };
  clientesRepository.findById = async () => ({ id: 1, tipoPessoa: "PF", nome: "Pessoa", cpf: "52998224725" });
  clientesRepository.findByNome = async () => { throw new Error("Individuals may have equal names"); };
  clientesRepository.findByCpf = async () => null;
  clientesRepository.create = async (data) => data;
  clientesRepository.update = async (id, data) => ({ id, ...data });
  try {
    assert.equal((await clientesService.create({ tipoPessoa: "PF", nome: "Pessoa", cpf: "52998224725" })).nome, "Pessoa");
    clientesRepository.findByCpf = async () => ({ id: 1 });
    await assert.rejects(clientesService.create({ tipoPessoa: "PF", nome: "Outra", cpf: "52998224725" }), { statusCode: 409 });
    await assert.rejects(clientesService.update(2, { cpf: "52998224725" }), { statusCode: 409 });
    assert.equal((await clientesService.update(1, { cpf: "52998224725", nome: "Pessoa editada" })).id, 1);
    await assert.rejects(clientesService.update(1, { cnpj: "00000000000191" }), { statusCode: 400 });
    await assert.rejects(clientesService.update(1, { cpf: null }), { statusCode: 400 });
    await assert.rejects(clientesService.update(1, { tipoPessoa: "PJ" }), { statusCode: 400 });
    clientesRepository.findById = async () => ({ id: 1, tipoPessoa: "PJ" });
    await assert.rejects(clientesService.update(1, { cpf: "52998224725" }), { statusCode: 400 });
  } finally { Object.assign(clientesRepository, original); }
});

test("company validation normalizes documents and preserves legacy partial updates", () => {
  assert.equal(normalizeCnpj("00.000.000/0001-91"), "00000000000191");
  assert.equal(isValidCnpj("00000000000191"), true);
  assert.equal(isValidCnpj("00000000E08G12"), true);
  for (const invalid of ["00000000000000", "11111111111111", "00000000000192", "000000000001", "!!!!!!!!!!!!91"]) assert.equal(isValidCnpj(invalid), false);
  const parsed = clienteCreateSchema.parse({ nome: "Empresa", cnpj: "00.000.000/0001-91", cep: "70040-912", estado: "df" });
  assert.equal(parsed.cnpj, "00000000000191");
  assert.equal(parsed.cep, "70040912");
  assert.equal(parsed.estado, "DF");
  assert.equal(clienteCreateSchema.safeParse({ nome: "Empresa" }).success, false);
  assert.equal(clienteCreateSchema.safeParse({ nome: "Empresa", cnpj: "00000000000191", email: "invalid" }).success, false);
  assert.deepEqual(clienteUpdateSchema.parse({ telefone: null, nome: "Empresa antiga" }), { telefone: null, nome: "Empresa antiga" });
  assert.equal(clienteUpdateSchema.safeParse({}).success, false);
});

test("ReceitaWS mapping, cache and failure responses", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(url, "https://receitaws.com.br/v1/cnpj/00000000000191");
    return new Response(JSON.stringify({ status: "OK", nome: "Banco do Brasil", fantasia: "BB", municipio: "Brasília", uf: "DF", cep: "70.040-912", telefone: "(61) 1234-5678 / (61) 99999-9999", situacao: "ATIVA", atividade_principal: [{ text: "Bancos comerciais" }], email: "" }));
  };
  try {
    const result = await consultarCnpj("00.000.000/0001-91");
    assert.equal(result.nome, "Banco do Brasil");
    assert.equal(result.nomeFantasia, "BB");
    assert.equal(result.cep, "70040912");
    assert.equal(result.cidade, "Brasília");
    assert.equal(result.situacaoCadastral, "ATIVA");
    assert.equal(result.email, null);
    assert.equal(result.status, undefined);
    await consultarCnpj("00000000000191");
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response("", { status: 429 });
    await assert.rejects(consultarCnpj("00000000E08G12"), { statusCode: 429 });
    globalThis.fetch = async () => new Response(JSON.stringify({ status: "ERROR", message: "CNPJ não encontrado" }));
    await assert.rejects(consultarCnpj("00000000E08G12"), { statusCode: 404 });
    globalThis.fetch = async () => new Response("not-json");
    await assert.rejects(consultarCnpj("00000000E08G12"), { statusCode: 503 });
    globalThis.fetch = async () => { throw new Error("timeout"); };
    await assert.rejects(consultarCnpj("00000000E08G12"), { statusCode: 503 });
  } finally { globalThis.fetch = originalFetch; }
});

test("duplicate CNPJ is blocked while editing its own account is allowed", async () => {
  const original = { ...clientesRepository };
  clientesRepository.findById = async () => ({ id: 1, nome: "Empresa" });
  clientesRepository.findByNome = async () => null;
  clientesRepository.findByCnpj = async () => ({ id: 1 });
  clientesRepository.update = async (id, data) => ({ id, ...data });
  try {
    await assert.rejects(clientesService.create({ nome: "Outro", cnpj: "00000000000191" }), { statusCode: 409 });
    await assert.rejects(clientesService.update(2, { cnpj: "00000000000191" }), { statusCode: 409 });
    assert.equal((await clientesService.update(1, { cnpj: "00000000000191" })).id, 1);
  } finally { Object.assign(clientesRepository, original); }
});
