/**
 * [SCHEMA][VALIDACAO] Filtros do dashboard e dos relatórios vindos da URL (período, cliente,
 * projetos, colaborador, sprint, equipe e status). Converte texto da URL em número e recusa datas
 * invertidas.
 */

import { z } from "zod";
import { statusProjetoSchema } from "./statusProjetoSchema.js";

export const LIMITE_PROJETOS_FILTRO = 50;

const date = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .optional();
const id = z.coerce.number().int().positive();

// Vários projetos chegam como "1,2" ou repetidos na URL (?projetoIds=1&projetoIds=2).
const projetoIds = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    const partes = (Array.isArray(value) ? value : String(value).split(","))
      .map((item) => String(item).trim())
      .filter(Boolean);
    return partes.length ? partes : undefined;
  },
  z
    .array(id, { message: "Informe os projetos pelos códigos numéricos." })
    .max(LIMITE_PROJETOS_FILTRO, `Selecione até ${LIMITE_PROJETOS_FILTRO} projetos.`)
    .optional(),
);

/**
 * Recorte comum do dashboard geral, dos dashboards individuais e do relatório em Excel.
 * "projetoId" continua aceito e vira um item de "projetoIds".
 */
export const dashboardQuerySchema = z
  .object({
    dataInicio: date,
    dataFim: date,
    clienteId: id.optional(),
    projetoId: id.optional(),
    projetoIds,
    colaboradorId: id.optional(),
    sprintId: id.optional(),
    statusProjeto: statusProjetoSchema.optional(),
    equipe: z.string().trim().min(1).max(255).optional(),
  })
  .refine((data) => !data.dataInicio || !data.dataFim || data.dataInicio <= data.dataFim, {
    path: ["dataFim"],
    message: "Data final deve ser igual ou posterior à inicial.",
  })
  .transform(({ projetoId, projetoIds: lista, ...resto }) => {
    const ids = [...new Set([...(lista ?? []), ...(projetoId ? [projetoId] : [])])].sort(
      (a, b) => a - b,
    );
    return ids.length ? { ...resto, projetoIds: ids } : resto;
  });
