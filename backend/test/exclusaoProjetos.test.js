import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { exclusaoProjetosRepository as repository } from "../src/repositories/exclusaoProjetosRepository.js";

const empty = { equipe: 0, tarefas: 0, sprints: 0, apontamentos: 0, avaliacoes: 0 };
test("consulta de exclusão conta todo histórico, sem filtrar status ou vigência", async () => {
  for (const key of Object.keys(empty)) {
    const info = await repository.inspect(1, {
      projeto: {
        findUnique: async (query) => {
          assert.deepEqual(
            query.select._count.select,
            Object.fromEntries(Object.keys(empty).map((field) => [field, true])),
          );
          return { id: 1, nome: "Histórico", _count: { ...empty, [key]: 1 } };
        },
      },
    });
    assert.equal(info.podeExcluir, false);
    assert.equal(info.vinculos[key], 1);
  }
  await assert.rejects(repository.inspect(1, { projeto: { findUnique: async () => null } }), {
    statusCode: 404,
  });
});

test("exclusão bloqueia o projeto, revalida e só remove cadastros sem referências", async (t) => {
  const original = prisma.$transaction;
  t.after(() => {
    prisma.$transaction = original;
  });
  let counts = { ...empty },
    writes = 0;
  prisma.$transaction = async (operation, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    let locked = false;
    return operation({
      $queryRaw: async (strings, id) => {
        assert.match(strings.join("?"), /FOR UPDATE/);
        assert.equal(id, 4);
        locked = true;
      },
      projeto: {
        findUnique: async () => {
          assert.equal(locked, true);
          return { id: 4, nome: "Teste", _count: counts };
        },
        delete: async ({ where }) => {
          assert.equal(where.id, 4);
          writes++;
        },
      },
    });
  };
  for (const key of Object.keys(empty)) {
    counts = { ...empty, [key]: 1 };
    await assert.rejects(repository.remove(4), { statusCode: 409 });
  }
  assert.equal(writes, 0);
  counts = { ...empty };
  await repository.remove(4);
  assert.equal(writes, 1);
});

test("FK concorrente vira conflito e serialização tem tentativas limitadas", async (t) => {
  const original = prisma.$transaction;
  t.after(() => {
    prisma.$transaction = original;
  });
  prisma.$transaction = async () => {
    throw Object.assign(new Error("FK"), { code: "P2003" });
  };
  await assert.rejects(repository.remove(4), { statusCode: 409 });
  let calls = 0;
  prisma.$transaction = async () => {
    calls++;
    throw Object.assign(new Error("Concorrência"), { code: "P2034" });
  };
  await assert.rejects(repository.remove(4), { statusCode: 409 });
  assert.equal(calls, 3);
});
