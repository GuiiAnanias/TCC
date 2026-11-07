import test from "node:test";
import assert from "node:assert/strict";
import { projetosService } from "../src/services/projetosService.js";
import { projetosRepository } from "../src/repositories/projetosRepository.js";
import { clientesRepository } from "../src/repositories/clientesRepository.js";

test("edição conserva cliente inativo já vinculado, mas rejeita outro inativo", async () => {
  const projects = { ...projetosRepository };
  const clients = { ...clientesRepository };
  const writes = [];
  projetosRepository.findById = async () => ({ id: 1, clienteId: 4 });
  projetosRepository.update = async (id, data) => {
    writes.push(data);
    return { id, ...data };
  };
  clientesRepository.findById = async (id) => ({ id, status: id === 6 ? "ATIVO" : "INATIVO" });
  try {
    await projetosService.update(1, { clienteId: 4, nome: "Nome corrigido" });
    await projetosService.update(1, { nome: "Outra correção" });
    await assert.rejects(projetosService.update(1, { clienteId: 5 }), { statusCode: 400 });
    await assert.rejects(projetosService.create({ clienteId: 4 }), { statusCode: 400 });
    await projetosService.update(1, { clienteId: 6 });
    assert.equal(writes.length, 3);
  } finally {
    Object.assign(projetosRepository, projects);
    Object.assign(clientesRepository, clients);
  }
});
