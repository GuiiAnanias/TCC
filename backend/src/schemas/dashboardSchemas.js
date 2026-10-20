import { z } from "zod";

const date = z.string().date().transform((value) => new Date(`${value}T00:00:00.000Z`)).optional();
export const dashboardQuerySchema = z.object({
  dataInicio: date,
  dataFim: date,
  clienteId: z.coerce.number().int().positive().optional(),
  projetoId: z.coerce.number().int().positive().optional(),
  colaboradorId: z.coerce.number().int().positive().optional(),
  sprintId: z.coerce.number().int().positive().optional(),
  statusProjeto: z.enum(["ATIVO", "INATIVO"]).optional(),
  equipe: z.string().trim().min(1).max(255).optional()
}).refine((data) => !data.dataInicio || !data.dataFim || data.dataInicio <= data.dataFim, {
  path: ["dataFim"], message: "Data final deve ser igual ou posterior à inicial."
});
