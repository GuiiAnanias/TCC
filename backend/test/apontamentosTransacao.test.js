import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { apontamentosRepository as repository } from "../src/repositories/apontamentosRepository.js";

test("apontamentos repetem a transação inteira após conflito de serialização", async () => {
  const original = prisma.$transaction;
  let attempts = 0;
  const clients = [];
  prisma.$transaction = async (operation, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const client = { attempt: ++attempts };
    const result = await operation(client);
    if (attempts < 3) throw Object.assign(new Error("serialization"), { code: "P2034" });
    return result;
  };
  try {
    const result = await repository.transaction(async (db) => { clients.push(db.attempt); return db.attempt; });
    assert.equal(result, 3);
    assert.deepEqual(clients, [1, 2, 3]);
  } finally { prisma.$transaction = original; }
});

test("conflitos persistentes retornam 409 e erros de negócio não são repetidos", async () => {
  const original = prisma.$transaction;
  let attempts = 0;
  try {
    prisma.$transaction = async () => { attempts++; throw Object.assign(new Error("serialization"), { code: "P2034" }); };
    await assert.rejects(repository.transaction(async () => {}), { statusCode: 409 });
    assert.equal(attempts, 3);
    attempts = 0;
    const invalid = Object.assign(new Error("Limite diário excedido"), { statusCode: 400 });
    prisma.$transaction = async () => { attempts++; throw invalid; };
    await assert.rejects(repository.transaction(async () => {}), (error) => error === invalid);
    assert.equal(attempts, 1);
  } finally { prisma.$transaction = original; }
});
