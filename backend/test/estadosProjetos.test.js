import test from "node:test";
import assert from "node:assert/strict";
import {
  projetoCreateSchema,
  projetoUpdateSchema,
  projetoQuerySchema,
} from "../src/schemas/projetosSchemas.js";
import { dashboardQuerySchema } from "../src/schemas/dashboardSchemas.js";
import { colaboradorCreateSchema } from "../src/schemas/colaboradoresSchemas.js";
import { projetosService } from "../src/services/projetosService.js";
import { projetosRepository } from "../src/repositories/projetosRepository.js";

const base = {
  clienteId: 1,
  nome: "Projeto demo",
  tipoContrato: "FEE_MENSAL",
  horasContratadas: 10,
  valorProjeto: 1000,
  dataInicio: "2026-10-01",
};

test("projetos aceitam contratos documentados e rejeitam classificações antigas", () => {
  for (const tipoContrato of ["ESCOPO_FECHADO", "POR_HORA", "FEE_MENSAL", "SQUAD"])
    assert.equal(projetoCreateSchema.parse({ ...base, tipoContrato }).tipoContrato, tipoContrato);
  for (const tipoContrato of ["FIXO", "HORAS", "FECHADO", "ESCOPO_SEMIABERTO"])
    assert.equal(projetoCreateSchema.safeParse({ ...base, tipoContrato }).success, false);
  for (const status of ["ATIVO", "PAUSADO", "ENCERRADO", "CANCELADO"]) {
    assert.equal(projetoUpdateSchema.parse({ status }).status, status);
    assert.equal(projetoQuerySchema.parse({ status }).status, status);
    assert.equal(dashboardQuerySchema.parse({ statusProjeto: status }).statusProjeto, status);
  }
  assert.equal(projetoUpdateSchema.safeParse({ status: "INATIVO" }).success, false);
  assert.equal(projetoCreateSchema.safeParse({ ...base, status: "ENCERRADO" }).success, false);
});

test("estados de projetos não vazam para o cadastro de colaboradores", () => {
  const person = {
    nomeCompleto: "Pessoa Demo",
    email: "demo@exemplo.com",
    cargo: "QA",
    departamento: "Qualidade",
  };
  assert.equal(colaboradorCreateSchema.safeParse({ ...person, status: "PAUSADO" }).success, false);
  assert.equal(
    colaboradorCreateSchema.safeParse({ ...person, nomeCompleto: "Pessoa" }).success,
    false,
  );
  assert.equal(colaboradorCreateSchema.parse({ ...person, status: "INATIVO" }).status, "INATIVO");
});

test("encerrar e reativar projetos altera apenas o estado, sem remover histórico", async (t) => {
  const original = { ...projetosRepository };
  t.after(() => Object.assign(projetosRepository, original));
  const record = {
    id: 1,
    ...base,
    status: "ATIVO",
    equipe: [{ id: 2 }],
    apontamentos: [{ id: 3 }],
  };
  projetosRepository.findById = async () => record;
  projetosRepository.update = async (id, data) => {
    assert.equal(id, 1);
    assert.deepEqual(Object.keys(data), ["status"]);
    Object.assign(record, data);
    return record;
  };
  assert.equal((await projetosService.close(1)).status, "ENCERRADO");
  // Pausado volta direto; cancelado e encerrado precisam da confirmação explícita.
  record.status = "PAUSADO";
  assert.equal((await projetosService.update(1, { status: "ATIVO" })).status, "ATIVO");
  for (const status of ["ENCERRADO", "CANCELADO"]) {
    record.status = status;
    await assert.rejects(projetosService.update(1, { status: "ATIVO" }), {
      statusCode: 409,
      details: { codigo: "REATIVACAO_SEM_CONFIRMACAO", statusAnterior: status },
    });
    assert.equal(record.status, status, "Sem confirmação, nada muda.");
    const active = await projetosService.update(1, {
      status: "ATIVO",
      confirmarReativacao: true,
    });
    assert.equal(active.status, "ATIVO");
    assert.deepEqual(active.apontamentos, [{ id: 3 }]);
    assert.deepEqual(active.equipe, [{ id: 2 }]);
  }
});

test("a confirmação de reativação é aceita na edição e não vira campo do projeto", () => {
  assert.equal(
    projetoUpdateSchema.parse({ status: "ATIVO", confirmarReativacao: true }).confirmarReativacao,
    true,
  );
  assert.equal(
    projetoUpdateSchema.safeParse({ status: "ATIVO", confirmarReativacao: "sim" }).success,
    false,
  );
});

test("os três estados não ativos impedem alterações da equipe", async (t) => {
  const original = { ...projetosRepository };
  t.after(() => Object.assign(projetosRepository, original));
  projetosRepository.transaction = async (operation) => operation();
  for (const status of ["PAUSADO", "ENCERRADO", "CANCELADO"]) {
    projetosRepository.findById = async () => ({ id: 1, status });
    await assert.rejects(projetosService.addTeamMember(1, { colaboradorId: 2 }), {
      statusCode: 400,
    });
    await assert.rejects(projetosService.updateTeamMember(1, 2, { papel: "Dev" }), {
      statusCode: 400,
    });
    await assert.rejects(projetosService.removeTeamMember(1, 2), { statusCode: 400 });
  }
});
