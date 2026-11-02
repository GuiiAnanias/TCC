import { z } from "zod";
export const awardCategory = z.enum(["DEV", "PO_SM"]);
const id = z.number().int().positive();
const pct = z.number().finite().min(0).max(100).multipleOf(0.0001);
const text = z.string().trim().max(5000);
const uniqueIds = z
  .array(id)
  .max(100)
  .refine((rows) => new Set(rows).size === rows.length, "Seleção repetida.");
export const awardRuleSchema = z
  .object({
    nome: z.string().trim().min(3).max(150),
    categoria: awardCategory,
    pontuacaoBase: z.number().finite().min(0).max(100).multipleOf(0.01),
    criterios: z
      .array(
        z
          .object({
            chave: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
            titulo: z.string().trim().min(3).max(500),
            deducao: z.number().finite().min(0).max(100).multipleOf(0.01),
            fonte: z.string().trim().min(3).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .refine(
        (rows) => new Set(rows.map((r) => r.chave)).size === rows.length,
        "Critério repetido.",
      ),
    faixas: z
      .array(
        z
          .object({
            minimo: z.number().finite().min(-5000).max(100).multipleOf(0.01),
            maximo: z.number().finite().min(-5000).max(100).multipleOf(0.01),
            percentual: pct,
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const sorted = [...value.faixas].sort((a, b) => a.minimo - b.minimo);
    sorted.forEach((row, i) => {
      if (row.minimo > row.maximo || (i > 0 && row.minimo <= sorted[i - 1].maximo))
        ctx.addIssue({
          code: "custom",
          path: ["faixas"],
          message: "Faixas devem ter início ≤ fim e não podem se sobrepor (limites inclusivos).",
        });
    });
  });
export const awardInputSchema = z
  .object({
    projetoIds: uniqueIds.min(1, "Selecione ao menos um projeto para avaliar."),
    sprintIds: uniqueIds,
    respostas: z
      .array(
        z
          .object({
            chave: z.string().max(50),
            situacao: z.enum(["PENDENTE", "SIM", "NAO", "NA"]),
            evidencia: text,
          })
          .strict(),
      )
      .max(50)
      .refine(
        (rows) => new Set(rows.map((r) => r.chave)).size === rows.length,
        "Resposta repetida.",
      ),
    percentualBase: pct.nullable(),
    percentualInformado: pct.nullable(),
    justificativaPercentual: text,
    observacoes: text,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.percentualInformado != null && value.justificativaPercentual.length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["justificativaPercentual"],
        message: "Informe a justificativa e a origem do percentual informado.",
      });
    if (
      value.respostas.some(
        (row) => ["SIM", "NA"].includes(row.situacao) && row.evidencia.length < 3,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["respostas"],
        message: "Ocorrências e critérios não aplicáveis exigem evidência ou justificativa.",
      });
  });
const identity = {
  colaboradorId: id,
  competencia: z
    .string()
    .regex(/^(20\d{2})-(0[1-9]|1[0-2])$/, "Informe uma competência válida (2000–2099)."),
  regraId: id,
};
export const awardCreateSchema = z
  .object({ ...identity, anteriorId: id.nullable().optional(), dados: awardInputSchema })
  .strict();
export const awardUpdateSchema = z.object({ revisao: id, dados: awardInputSchema }).strict();
export const awardCloseSchema = z.object({ revisao: id }).strict();
export const awardQuerySchema = z
  .object({
    colaboradorId: z.coerce.number().int().positive().optional(),
    competencia: identity.competencia.optional(),
    categoria: awardCategory.optional(),
    status: z.enum(["RASCUNHO", "CONCLUIDA"]).optional(),
  })
  .strict();
