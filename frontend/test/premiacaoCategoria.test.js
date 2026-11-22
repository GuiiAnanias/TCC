import test from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../scripts/testes/dom.mjs";

const cleanup = installDom();
const { categoriaSugerida, selecaoDaCategoria } = await import("../src/pages/PremiacaoPage.jsx");
cleanup();

// Como na Ana em novembro: Dev em quatro projetos e Product Owner em um.
const projetosDaAna = [
  { id: 1, papeis: ["Dev"], categorias: ["DEV"] },
  { id: 2, papeis: ["Dev"], categorias: ["DEV"] },
  { id: 3, papeis: ["Dev"], categorias: ["DEV"] },
  { id: 4, papeis: ["Dev"], categorias: ["DEV"] },
  { id: 5, papeis: ["Product Owner"], categorias: ["PO_SM"] },
];

test("categoria sugerida é a do papel que a pessoa mais exerceu no mês", () => {
  assert.equal(categoriaSugerida(projetosDaAna, "PO_SM"), "DEV");
  assert.equal(categoriaSugerida([projetosDaAna[4]], "DEV"), "PO_SM");
  // Empate ou nenhum projeto: mantém a atual.
  assert.equal(categoriaSugerida([projetosDaAna[0], projetosDaAna[4]], "PO_SM"), "PO_SM");
  assert.equal(categoriaSugerida([], "DEV"), "DEV");
});

test("trocar a categoria tira da seleção os projetos de outro papel e as sprints deles", () => {
  const dados = { projetoIds: [1, 5], sprintIds: [10, 50], respostas: [] };
  const sprints = [
    { id: 10, projetoId: 1 },
    { id: 50, projetoId: 5 },
  ];
  const comoDev = selecaoDaCategoria(dados, projetosDaAna, "DEV", sprints);
  assert.deepEqual(comoDev.projetoIds, [1]);
  assert.deepEqual(comoDev.sprintIds, [10]);
  const comoPoSm = selecaoDaCategoria(dados, projetosDaAna, "PO_SM", sprints);
  assert.deepEqual(comoPoSm.projetoIds, [5]);
  assert.deepEqual(comoPoSm.sprintIds, [50]);
  // Nada a tirar: devolve o mesmo objeto (sem marcar o formulário como alterado à toa).
  const soDev = { projetoIds: [1, 2], sprintIds: [], respostas: [] };
  assert.equal(selecaoDaCategoria(soDev, projetosDaAna, "DEV", sprints), soDev);
});
