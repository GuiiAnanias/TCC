import test from "node:test";
import assert from "node:assert/strict";
import {
  remuneracaoCreateSchema,
  remuneracaoUpdateSchema,
} from "../src/schemas/remuneracoesSchemas.js";

test("faixa de remuneração descarta os campos legados de bonificação", () => {
  const parsed = remuneracaoCreateSchema.parse({
    nivel: "Júnior II",
    valorHora: 45,
    bonificacao: 5,
    tipoBonificacao: "PERCENTUAL",
  });
  assert.deepEqual(parsed, { nivel: "Júnior II", valorHora: 45 });
  assert.equal(
    remuneracaoUpdateSchema.safeParse({ bonificacao: 5, tipoBonificacao: "PERCENTUAL" }).success,
    false,
  );
  assert.deepEqual(remuneracaoUpdateSchema.parse({ valorHora: 50, bonificacao: 5 }), {
    valorHora: 50,
  });
});
