import { test } from "node:test";
import assert from "node:assert/strict";
import { consultarCep } from "../src/services/cepService.js";
import { clienteCreateSchema } from "../src/schemas/clientesSchemas.js";
import { formatTelefone } from "../../frontend/src/utils/formatosCadastro.js";

test("telephone accepts landlines and mobiles with DDD, rejects incomplete and excessive digits", () => {
  assert.equal(formatTelefone("11999991234567890"), "(11) 99999-1234");
  assert.equal(formatTelefone("1133331234"), "(11) 3333-1234");
  assert.equal(formatTelefone("abc"), "");
  assert.equal(formatTelefone("119"), "(11) 9");
  assert.equal(formatTelefone("(11) 3333-1234 / (11) 99999-1234"), "(11) 3333-1234");
  const base = { tipoPessoa: "PF", nome: "Pessoa", cpf: "52998224725" };
  assert.equal(
    clienteCreateSchema.parse({ ...base, telefone: "(11) 99999-1234" }).telefone,
    "11999991234",
  );
  assert.equal(
    clienteCreateSchema.parse({ ...base, telefone: "(11) 3333-1234" }).telefone,
    "1133331234",
  );
  for (const telefone of ["123", "119999912345", "abc11999991234", "(00) 99999-1234"])
    assert.equal(clienteCreateSchema.safeParse({ ...base, telefone }).success, false);
  assert.equal(clienteCreateSchema.safeParse({ ...base, telefone: null }).success, true);
});

test("CEP maps complete and city-only addresses, caches results and reports provider failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(url, "https://viacep.com.br/ws/01001000/json/");
    return new Response(
      JSON.stringify({
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
        complemento: "lado ímpar",
      }),
    );
  };
  try {
    assert.deepEqual(await consultarCep("01001-000"), {
      cep: "01001000",
      logradouro: "Praça da Sé",
      bairro: "Sé",
      cidade: "São Paulo",
      estado: "SP",
    });
    await consultarCep("01001000");
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ logradouro: "", bairro: "", localidade: "Cidade", uf: "MG" }));
    assert.deepEqual(await consultarCep("35400000"), {
      cep: "35400000",
      logradouro: "",
      bairro: "",
      cidade: "Cidade",
      estado: "MG",
    });
    await assert.rejects(consultarCep("12abc345"), { statusCode: 400 });
    globalThis.fetch = async () => new Response(JSON.stringify({ erro: true }));
    await assert.rejects(consultarCep("99999999"), { statusCode: 404 });
    globalThis.fetch = async () => new Response("", { status: 500 });
    await assert.rejects(consultarCep("88888888"), { statusCode: 502 });
    globalThis.fetch = async () => {
      throw new Error("timeout");
    };
    await assert.rejects(consultarCep("77777777"), { statusCode: 503 });
    globalThis.fetch = async () => new Response(JSON.stringify({}));
    await assert.rejects(consultarCep("66666666"), { statusCode: 502 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
