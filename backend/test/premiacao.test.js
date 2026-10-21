import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateAward, premiacaoTemplates } from "../src/services/premiacaoRules.js";
import { awardRuleSchema, awardInputSchema, awardCreateSchema } from "../src/schemas/premiacaoSchemas.js";
const base = () => ({ projetoIds: [1], sprintIds: [], percentualBase: 5, percentualInformado: null, justificativaPercentual: "", observacoes: "", respostas: premiacaoTemplates.DEV.criterios.map((row) => ({ chave: row.chave, situacao: "NAO", evidencia: "" })) });
test("premiação transcreve critérios, pesos e último critério PO/SM sem inventar faixas", () => {
  assert.equal(premiacaoTemplates.DEV.criterios.length, 8);
  assert.equal(premiacaoTemplates.PO_SM.criterios.length, 10);
  assert.equal(premiacaoTemplates.PO_SM.criterios.at(-1).chave, "sem_sprint");
  assert.equal(premiacaoTemplates.DEV.criterios.reduce((s, row) => s + row.deducao, 0), 8);
  for (const model of Object.values(premiacaoTemplates)) { assert.equal(awardRuleSchema.safeParse(model).success, true); assert.deepEqual(model.faixas, []); }
});
test("nota desconta cada critério uma vez, não quantidade de tarefas, e distingue nota de percentual", () => {
  const data = base(); data.respostas[0] = { chave: "estimativas", situacao: "SIM", evidencia: "Cinco tarefas conferidas: razão inferior a 75%." };
  const result = calculateAward(premiacaoTemplates.DEV, data);
  assert.equal(result.deducoes, 1); assert.equal(result.notaFinal, 9); assert.equal(result.percentualFinal, null);
  assert.match(result.motivos.join(" "), /Sem faixa/);
});
test("faixas inclusivas, lacunas, limites e percentual informado justificado", () => {
  const rule = { ...premiacaoTemplates.DEV, faixas: [{ minimo: 9, maximo: 10, percentual: 80 }] };
  let data = base();
  assert.equal(calculateAward(rule, data).percentualFinal, 4);
  data.respostas[0].situacao = "SIM"; data.respostas[0].evidencia = "Conferida";
  assert.equal(calculateAward(rule, data).percentualFinal, 4);
  data.respostas[1].situacao = "SIM"; data.respostas[1].evidencia = "Conferida";
  assert.equal(calculateAward(rule, data).percentualFinal, null);
  data.percentualInformado = 0; data.justificativaPercentual = "Decisão registrada pela empresa";
  assert.equal(awardInputSchema.safeParse(data).success, true);
  assert.equal(calculateAward(rule, data).percentualFinal, 0);
  data.percentualBase = null; assert.equal(calculateAward(rule, data).percentualFinal, null);
});
test("pendências não recebem nota definitiva nem percentual; NA exige justificativa; sem piso presumido", () => {
  const data = base(); data.respostas.pop(); data.percentualInformado = 80;
  const result = calculateAward(premiacaoTemplates.DEV, data);
  assert.equal(result.pendentes, 1); assert.equal(result.notaFinal, null); assert.equal(result.percentualFinal, null);
  assert.equal(awardInputSchema.safeParse(data).success, false);
  data.justificativaPercentual = "Origem informada"; data.respostas[0].situacao = "NA";
  assert.equal(awardInputSchema.safeParse(data).success, false);
  data.respostas[0].evidencia = "Não há base completa";
  assert.equal(awardInputSchema.safeParse(data).success, true);
  const negative = calculateAward({ pontuacaoBase: 1, faixas: [], criterios: [{ chave: "teste", deducao: 2 }] }, { ...data, respostas: [{ chave: "teste", situacao: "SIM" }] });
  assert.equal(negative.notaFinal, -1);
});
test("validação rejeita sobreposição, faixas invertidas, respostas duplicadas, NaN e competência inválida", () => {
  for (const faixas of [[{ minimo: 0, maximo: 5, percentual: 50 }, { minimo: 5, maximo: 10, percentual: 100 }], [{ minimo: 6, maximo: 5, percentual: 50 }]]) assert.equal(awardRuleSchema.safeParse({ ...premiacaoTemplates.DEV, faixas }).success, false);
  const data = base(); data.respostas.push(data.respostas[0]); assert.equal(awardInputSchema.safeParse(data).success, false);
  assert.equal(awardInputSchema.safeParse({ ...base(), percentualBase: NaN }).success, false);
  assert.equal(awardCreateSchema.safeParse({ colaboradorId: 1, regraId: 1, competencia: "2026-13", dados: base() }).success, false);
});
