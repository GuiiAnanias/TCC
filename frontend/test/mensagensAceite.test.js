import test from "node:test";
import assert from "node:assert/strict";
import { resources } from "../src/config/cadastros.jsx";
import { validarFormulario } from "../src/pages/RelatoriosPage.jsx";
import { SENHA_ATUALIZADA } from "../src/pages/RedefinirSenhaPage.jsx";
import { falhaDoArquivo, sucessoDoArquivo } from "../src/utils/relatorioArquivos.js";

// As mensagens abaixo são citadas literalmente nos critérios de aceite do documento do TCC.

test("relatório sem filtro ou sem bloco usa as mensagens dos critérios de aceite", () => {
  const base = { projetoIds: [], clienteIds: [], dataInicio: "", dataFim: "", blocos: ["CUSTO"] };
  assert.equal(validarFormulario(base), "Selecione ao menos um filtro para gerar o relatório.");
  assert.equal(
    validarFormulario({ ...base, projetoIds: ["1"], blocos: [] }),
    "Selecione ao menos um bloco de dados para o relatório.",
  );
});

test("exportações informam sucesso e falta de relatório válido por formato", async () => {
  assert.equal(
    sucessoDoArquivo("pdf", "relatorio-1.pdf"),
    "Relatório PDF exportado com sucesso: relatorio-1.pdf.",
  );
  assert.equal(
    sucessoDoArquivo("xlsx", "relatorio-1.xlsx"),
    "Relatório XLSX exportado com sucesso: relatorio-1.xlsx.",
  );
  for (const status of [404, 409, 422]) {
    const erro = { response: { status, data: { message: "detalhe" } } };
    assert.equal(
      await falhaDoArquivo(erro, "pdf", "padrão"),
      "Não há dados disponíveis para exportação.",
    );
    assert.equal(
      await falhaDoArquivo(erro, "xlsx", "padrão"),
      "Não há relatório válido para exportar.",
    );
  }
  assert.equal(
    await falhaDoArquivo({ response: { status: 500, data: {} } }, "pdf", "Tente novamente."),
    "Tente novamente.",
    "Outros erros mantêm a mensagem de falha genérica.",
  );
});

test("listagens vazias e redefinição de senha usam os textos do documento", () => {
  const vazio = Object.fromEntries(resources.map((item) => [item.key, item.emptyMessage]));
  assert.equal(vazio.projetos, "Nenhum projeto cadastrado");
  assert.equal(vazio.colaboradores, "Nenhum colaborador cadastrado");
  assert.equal(vazio.remuneracoes, "Não há itens cadastrados");
  assert.equal(SENHA_ATUALIZADA, "Senha atualizada com sucesso");
});
