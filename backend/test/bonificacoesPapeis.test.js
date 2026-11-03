import { test } from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { bonificacaoPapelCreateSchema } from "../src/schemas/bonificacoesPapeisSchemas.js";
import { bonificacoesPapeisRepository } from "../src/repositories/bonificacoesPapeisRepository.js";
import { projetosService } from "../src/services/projetosService.js";
import { projetosRepository } from "../src/repositories/projetosRepository.js";

test("role bonuses require explicit nonnegative percentage and a valid effective date", () => {
  const valid = { papel: "Product Owner", percentual: "0", dataInicio: "2026-10-01" };
  assert.equal(bonificacaoPapelCreateSchema.parse(valid).percentual, 0);
  for (const percentual of ["", null, undefined, -1, "abc", Infinity, 0.001]) {
    assert.equal(bonificacaoPapelCreateSchema.safeParse({ ...valid, percentual }).success, false);
  }
  assert.equal(
    bonificacaoPapelCreateSchema.safeParse({ ...valid, dataInicio: "2026-02-30" }).success,
    false,
  );
});

test("new bonus percentages close the previous version without rewriting it or permitting retroactive replacement", async () => {
  const previous = {
    id: 1,
    papel: "Product Owner",
    percentual: 10,
    dataInicio: new Date("2026-01-01"),
  };
  const original = prisma.$transaction;
  const calls = [];
  prisma.$transaction = async (callback) =>
    callback({
      bonificacaoPapel: {
        findFirst: async () => previous,
        update: async (query) => {
          calls.push(query);
          return query;
        },
        create: async ({ data }) => ({ id: 2, ...data }),
      },
    });
  try {
    const result = await bonificacoesPapeisRepository.createVersion({
      papel: "Product Owner",
      percentual: 20,
      dataInicio: new Date("2026-10-01"),
    });
    assert.equal(result.percentual, 20);
    assert.deepEqual(calls[0].data, { dataFim: new Date("2026-10-01") });
    assert.equal(previous.percentual, 10);
    await assert.rejects(
      bonificacoesPapeisRepository.createVersion({
        papel: "Product Owner",
        percentual: 20,
        dataInicio: new Date("2026-01-01"),
      }),
      { statusCode: 400 },
    );
    assert.equal(calls.length, 1);
  } finally {
    prisma.$transaction = original;
  }
});

test("changing project role creates a dated version instead of rewriting the previous role", async () => {
  const originals = { ...projetosRepository };
  projetosRepository.transaction = async (operation) => operation({});
  projetosRepository.findOverlappingTeamMember = async () => null;
  const originalMember = {
    id: 1,
    projetoId: 2,
    colaboradorId: 3,
    papel: "Product Owner",
    dataEntrada: new Date("2026-01-01"),
    dataSaida: null,
  };
  projetosRepository.findById = async () => ({ id: 2, status: "ATIVO" });
  projetosRepository.findTeamMemberById = async () => originalMember;
  projetosRepository.updateTeamMember = async () => {
    throw new Error("A troca de papel não deve sobrescrever o vínculo");
  };
  projetosRepository.changeTeamRole = async (old, papel, date) => ({
    ...old,
    id: 4,
    papel,
    dataEntrada: date,
  });
  try {
    const result = await projetosService.updateTeamMember(2, 1, {
      papel: "Scrum Master",
      dataVigencia: new Date("2026-10-01"),
    });
    assert.equal(result.papel, "Scrum Master");
    assert.equal(originalMember.papel, "Product Owner");
    await assert.rejects(projetosService.updateTeamMember(2, 1, { papel: "Scrum Master" }), {
      statusCode: 400,
    });
    await assert.rejects(
      projetosService.updateTeamMember(2, 1, {
        papel: "Scrum Master",
        dataVigencia: new Date("2025-12-31"),
      }),
      { statusCode: 400 },
    );
  } finally {
    Object.assign(projetosRepository, originals);
  }
});
