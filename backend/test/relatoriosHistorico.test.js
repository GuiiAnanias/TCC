import test from "node:test";
import assert from "node:assert/strict";
import { relatorioListaSchema } from "../src/schemas/relatoriosSchemas.js";
import { resumoDoHistorico } from "../src/services/relatoriosGeradosService.js";

test("a consulta do histórico pagina com limite e usa os dias de Brasília", () => {
  assert.deepEqual(relatorioListaSchema.parse({}), { pagina: 1, porPagina: 20 });
  const filtros = relatorioListaSchema.parse({
    pagina: "3",
    porPagina: "50",
    autorId: "2",
    projetoId: "7",
    geradoDe: "2026-11-01",
    geradoAte: "2026-11-08",
  });
  assert.equal(filtros.pagina, 3);
  assert.equal(filtros.autorId, 2);
  assert.equal(filtros.geradoDe.toISOString(), "2026-11-01T03:00:00.000Z");
  assert.equal(relatorioListaSchema.safeParse({ porPagina: "51" }).success, false);
  assert.equal(relatorioListaSchema.safeParse({ pagina: "0" }).success, false);
  assert.equal(relatorioListaSchema.safeParse({ ordem: "asc" }).success, false);
  assert.equal(
    relatorioListaSchema.safeParse({ geradoDe: "2026-11-08", geradoAte: "2026-11-01" }).success,
    false,
  );
});

test("a linha do histórico resume o pedido e conta os downloads por formato", () => {
  const registro = {
    id: 9,
    versao: 2,
    createdAt: new Date("2026-11-08T16:00:00.000Z"),
    criadoPor: { id: 1, nomeUsuario: "admin" },
    blocos: ["PROJETOS", "CUSTO"],
    filtros: { projetoIds: [1, 2], clienteIds: [5], dataInicio: "2026-10-01", dataFim: null },
    conteudo: {
      projetos: [
        { id: 1, nome: "Portal", cliente: "Cliente A", clienteId: 5 },
        { id: 2, nome: "Mobile", cliente: "Cliente A", clienteId: 5 },
        { id: 3, nome: "Outro", cliente: "Cliente B", clienteId: 6 },
      ],
      dados: { PROJETOS: { linhas: [] } },
    },
  };
  const exportacoes = [
    {
      relatorioId: 9,
      formato: "PDF",
      _count: { _all: 2 },
      _max: { createdAt: new Date("2026-11-08T17:00:00.000Z") },
    },
    {
      relatorioId: 9,
      formato: "XLSX",
      _count: { _all: 1 },
      _max: { createdAt: new Date("2026-11-08T18:00:00.000Z") },
    },
    { relatorioId: 10, formato: "PDF", _count: { _all: 5 }, _max: { createdAt: new Date() } },
  ];
  const linha = resumoDoHistorico(registro, exportacoes);
  assert.deepEqual(linha.clientes, ["Cliente A"]);
  assert.deepEqual(linha.projetosSelecionados, ["Portal", "Mobile"]);
  assert.equal(linha.projetosNoRecorte, 3);
  assert.deepEqual(linha.periodo, { dataInicio: "2026-10-01", dataFim: null });
  assert.equal(linha.autor, "admin");
  assert.equal(linha.exportacoes.PDF, 2, "Só os downloads deste relatório.");
  assert.equal(linha.exportacoes.XLSX, 1);
  assert.equal(linha.exportacoes.ultima.toISOString(), "2026-11-08T18:00:00.000Z");
  assert.equal("conteudo" in linha, false, "A lista não devolve os dados dos blocos.");
  assert.deepEqual(resumoDoHistorico({ ...registro, id: 11 }, exportacoes).exportacoes, {
    PDF: 0,
    XLSX: 0,
    ultima: null,
  });
});
