/**
 * [BANCO] Exemplos de premiação do seed: publica as regras de exemplo e cria duas avaliações (uma
 * concluída e um rascunho).
 */

import { premiacaoTemplates } from "../src/services/regrasPremiacao.js";
import { buildAwardContent } from "../src/repositories/premiacaoRepository.js";

// Exemplos de avaliação autorizados para o seed. Percentuais informados são
// fictícios e explicitamente identificados; nenhuma faixa da empresa é presumida.
export async function seedAwards(tx, { admin, people, projects }) {
  for (const [categoria, person, project, concluded] of [
    ["DEV", "ana", "portal", false],
    ["PO_SM", "bruno", "mobile", true],
  ]) {
    const { nome: originalName, ...template } = premiacaoTemplates[categoria];
    const nome = `${originalName} (demo)`;
    let rule = await tx.regraPremiacao.findFirst({
      where: { nome, categoria },
      orderBy: { id: "asc" },
    });
    if (!rule) {
      const { categoria: ignored, ...definicao } = template;
      rule = await tx.regraPremiacao.create({
        data: { nome, categoria, definicao, criadoPorId: admin.id },
      });
    }
    const identity = { colaboradorId: people[person].id, competencia: "2026-10", categoria };
    if (await tx.avaliacaoPremiacao.findFirst({ where: identity })) continue;
    const dados = {
      projetoIds: [projects[project].id],
      sprintIds: [],
      respostas: rule.definicao.criterios.map((row) => ({
        chave: row.chave,
        situacao: concluded ? (row.chave === "estimativas" ? "SIM" : "NA") : "PENDENTE",
        evidencia: concluded
          ? row.chave === "estimativas"
            ? "Exemplo fictício: contexto do Aplicativo Mobile conferido no mês de outubro; assertividade inferior a 75%."
            : "Exemplo de demonstração: critério não avaliado por falta de evidência; não usar como decisão real."
          : "",
      })),
      percentualBase: concluded ? 5 : null,
      percentualInformado: concluded ? 80 : null,
      justificativaPercentual: concluded
        ? "Percentual fictício de 80% informado apenas para demonstrar o cálculo; não representa faixa de uma empresa real."
        : "",
      observacoes:
        "DEMONSTRAÇÃO. Contexto e percentuais de avaliação são fictícios. A base de 5%, quando usada, é exemplo manual e não foi vinculada à remuneração nem ao custo.",
    };
    const conteudo = await buildAwardContent(tx, identity, rule, dados, admin);
    await tx.avaliacaoPremiacao.create({
      data: {
        ...identity,
        regraId: rule.id,
        conteudo,
        criadoPorId: admin.id,
        ...(concluded
          ? { status: "CONCLUIDA", concluidoPorId: admin.id, concluidoEm: new Date() }
          : {}),
      },
    });
  }
}
