import { test } from "node:test";
import assert from "node:assert/strict";
import { cargosTi, niveisRemuneracao, papeisProjeto } from "../src/schemas/cadastroOptions.js";
import { colaboradorCreateSchema } from "../src/schemas/colaboradoresSchemas.js";
import {
  remuneracaoCreateSchema,
  remuneracaoUpdateSchema,
} from "../src/schemas/remuneracoesSchemas.js";
import { equipeProjetoCreateSchema } from "../src/schemas/equipeProjetoSchemas.js";
import { bonificacaoPapelCreateSchema } from "../src/schemas/bonificacoesPapeisSchemas.js";
import { remuneracoesService } from "../src/services/remuneracoesService.js";
import { remuneracoesRepository } from "../src/repositories/remuneracoesRepository.js";

test("cargo, remuneration level and project role accept their own domain values", () => {
  const person = {
    nomeCompleto: "Pessoa Exemplo",
    email: "pessoa@example.com",
    cargo: "Desenvolvedor Front-end",
    departamento: "Desenvolvimento",
  };
  const rate = { nivel: "Júnior II", valorHora: 45 };
  const member = { colaboradorId: 1, papel: "Scrum Master", dataEntrada: "2026-09-01" };
  assert.equal(colaboradorCreateSchema.parse(person).cargo, person.cargo);
  assert.equal(remuneracaoCreateSchema.parse(rate).nivel, "Júnior II");
  for (const valorHora of [0, 0.001, Infinity, 100000000])
    assert.equal(remuneracaoCreateSchema.safeParse({ ...rate, valorHora }).success, false);
  assert.equal(equipeProjetoCreateSchema.parse(member).papel, "Scrum Master");
  assert.equal(equipeProjetoCreateSchema.parse({ ...member, papel: "Dev" }).papel, "Dev");
  assert.equal(
    bonificacaoPapelCreateSchema.parse({ papel: "Dev", percentual: 10, dataInicio: "2026-09-01" })
      .papel,
    "Dev",
  );
  for (const nivel of ["QA", "Product Owner", "Desenvolvedor Front-end"])
    assert.equal(remuneracaoCreateSchema.safeParse({ ...rate, nivel }).success, false);
  assert.equal(colaboradorCreateSchema.safeParse({ ...person, cargo: "Júnior II" }).success, false);
  assert.equal(colaboradorCreateSchema.safeParse({ ...person, cargo: "Dev" }).success, false);
  assert.equal(
    equipeProjetoCreateSchema.safeParse({ ...member, papel: "Júnior II" }).success,
    false,
  );
  assert.equal(
    bonificacaoPapelCreateSchema.safeParse({
      papel: "Júnior II",
      percentual: 10,
      dataInicio: "2026-09-01",
    }).success,
    false,
  );
  assert.notEqual(cargosTi, papeisProjeto);
  assert.equal(niveisRemuneracao.length, 20);
  assert.ok(niveisRemuneracao.includes("Trainee I"));
  assert.ok(niveisRemuneracao.includes("Sênior V"));
  // Especialidades já usadas em vínculos permanecem válidas.
  assert.ok(papeisProjeto.includes("Desenvolvedor Front-end"));
  assert.ok(papeisProjeto.includes("QA"));
});

test("legacy remuneration names remain editable only on their own record without automatic conversion", async () => {
  const original = { ...remuneracoesRepository };
  const legacy = { id: 1, nivel: "QA", valorHora: 45, status: "ATIVO" };
  const writes = [];
  remuneracoesRepository.findById = async () => legacy;
  remuneracoesRepository.findByNivel = async (nivel) =>
    nivel === "QA" ? legacy : nivel === "Pleno I" ? { id: 2 } : null;
  remuneracoesRepository.update = async (id, data) => {
    writes.push(data);
    return { ...legacy, ...data, id };
  };
  try {
    const result = await remuneracoesService.update(
      1,
      remuneracaoUpdateSchema.parse({ nivel: "QA", valorHora: 45 }),
    );
    assert.equal(result.nivel, "QA");
    assert.equal(result.valorHora, 45);
    assert.equal(
      (await remuneracoesService.update(1, remuneracaoUpdateSchema.parse({ status: "INATIVO" })))
        .nivel,
      "QA",
    );
    await assert.rejects(
      remuneracoesService.update(
        1,
        remuneracaoUpdateSchema.parse({ nivel: "Analista de Negócios" }),
      ),
      { statusCode: 400 },
    );
    await assert.rejects(
      remuneracoesService.update(1, remuneracaoUpdateSchema.parse({ nivel: "Nível inventado" })),
      { statusCode: 400 },
    );
    await assert.rejects(
      remuneracoesService.update(1, remuneracaoUpdateSchema.parse({ nivel: "Pleno I" })),
      { statusCode: 409 },
    );
    assert.equal(writes.length, 2);
    const renamed = await remuneracoesService.update(
      1,
      remuneracaoUpdateSchema.parse({ nivel: "Júnior II" }),
    );
    assert.equal(renamed.nivel, "Júnior II");
    assert.equal(renamed.valorHora, 45);
    assert.deepEqual(writes[2], { nivel: "Júnior II" });
    assert.equal(legacy.nivel, "QA");
  } finally {
    Object.assign(remuneracoesRepository, original);
  }
});
