import test from "node:test";
import assert from "node:assert/strict";
import { projetoCreateSchema, projetoUpdateSchema } from "../src/schemas/projetosSchemas.js";
import { projetosService } from "../src/services/projetosService.js";
import { projetosRepository } from "../src/repositories/projetosRepository.js";
import { clientesRepository } from "../src/repositories/clientesRepository.js";
import { colaboradoresRepository } from "../src/repositories/colaboradoresRepository.js";
import { apontamentosService } from "../src/services/apontamentosService.js";
import { apontamentosRepository } from "../src/repositories/apontamentosRepository.js";

const project = {
  nome: "Projeto com equipe",
  clienteId: 1,
  tipoContrato: "SQUAD",
  horasContratadas: 10,
  valorProjeto: 1000,
  dataInicio: "2026-09-01",
};
const member = (id) => ({ colaboradorId: id, papel: "Dev", dataEntrada: "2026-09-01" });

test("equipe inicial é opcional e cada integrante exige pessoa, papel e entrada sem duplicação", () => {
  assert.ok(projetoCreateSchema.safeParse(project).success);
  assert.ok(projetoCreateSchema.safeParse({ ...project, equipeInicial: [] }).success);
  assert.equal(
    projetoCreateSchema.parse({ ...project, equipeInicial: [member(2), member(3)] }).equipeInicial
      .length,
    2,
  );
  for (const equipeInicial of [
    [member(2), member(2)],
    [{ colaboradorId: 2 }],
    [{ ...member(2), papel: "" }],
  ])
    assert.equal(projetoCreateSchema.safeParse({ ...project, equipeInicial }).success, false);
  assert.equal(projetoUpdateSchema.safeParse({ equipeInicial: [] }).success, false);
});

test("criação valida todos os integrantes e grava o projeto e seus vínculos na mesma transação", async (t) => {
  const repos = [projetosRepository, clientesRepository, colaboradoresRepository];
  const originals = repos.map((repo) => ({ ...repo }));
  t.after(() => repos.forEach((repo, i) => Object.assign(repo, originals[i])));
  const tx = { transaction: true };
  projetosRepository.transaction = async (operation) => operation(tx);
  clientesRepository.findById = async (_id, db) => {
    assert.equal(db, tx);
    return { status: "ATIVO" };
  };
  colaboradoresRepository.findById = async (_id, db) => {
    assert.equal(db, tx);
    return { status: "ATIVO" };
  };
  let writes = 0;
  projetosRepository.create = async (data, db) => {
    writes++;
    assert.equal(db, tx);
    assert.equal(data.equipeInicial, undefined);
    assert.deepEqual(
      data.equipe.create.map((m) => m.colaboradorId),
      [2, 3],
    );
    assert.ok(data.equipe.create.every((m) => m.dataEntrada instanceof Date));
    return { id: 10 };
  };
  await projetosService.create(
    projetoCreateSchema.parse({ ...project, equipeInicial: [member(2), member(3)] }),
  );
  assert.equal(writes, 1);
  colaboradoresRepository.findById = async () => ({ status: "INATIVO" });
  await assert.rejects(projetosService.create({ ...project, equipeInicial: [member(2)] }), {
    statusCode: 400,
  });
  assert.equal(writes, 1);
});

test("novas horas exigem equipe na data; correções no mesmo registro não apagam o histórico", async (t) => {
  const repos = [projetosRepository, colaboradoresRepository, apontamentosRepository];
  const originals = repos.map((repo) => ({ ...repo }));
  t.after(() => repos.forEach((repo, i) => Object.assign(repo, originals[i])));
  const tx = {};
  const record = {
    id: 4,
    projetoId: 1,
    colaboradorId: 2,
    tarefaId: null,
    data: new Date("2026-10-01"),
    horas: 1,
    status: "PENDENTE",
    descricao: "Histórico",
  };
  apontamentosRepository.transaction = async (operation) => operation(tx);
  apontamentosRepository.lockReferences = async () => {};
  projetosRepository.findById = async () => ({ status: "ATIVO" });
  colaboradoresRepository.findById = async () => ({ status: "ATIVO" });
  apontamentosRepository.findById = async () => record;
  let checks = 0,
    writes = 0;
  projetosRepository.hasOperationalTeam = async (_id, date, db) => {
    checks++;
    assert.equal(db, tx);
    assert.ok(date instanceof Date);
    return false;
  };
  apontamentosRepository.create = async () => writes++;
  apontamentosRepository.update = async () => writes++;
  apontamentosRepository.sumHorasNoDia = async () => 0;
  await assert.rejects(apontamentosService.create({ ...record, id: undefined }), {
    statusCode: 409,
  });
  await assert.rejects(apontamentosService.update(4, { projetoId: 3 }), { statusCode: 409 });
  await assert.rejects(apontamentosService.update(4, { data: new Date("2026-10-02") }), {
    statusCode: 409,
  });
  assert.equal(writes, 0);
  await apontamentosService.update(4, { descricao: "Correção histórica" });
  assert.equal(checks, 3);
  assert.equal(writes, 1);
});
