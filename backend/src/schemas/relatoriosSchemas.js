import { z } from "zod";

// Ordem de exibição dos blocos na prévia e nas exportações.
export const BLOCOS_RELATORIO = ["PROJETOS", "CLIENTES", "HORAS", "CUSTO", "INCONSISTENCIAS"];
export const LIMITE_PROJETOS_RELATORIO = 50;

const dia = z
  .string()
  .date("Data inválida.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const relatorioCreateSchema = z
  .object({
    projetoIds: z
      .array(z.number().int().positive())
      .max(LIMITE_PROJETOS_RELATORIO, `Selecione até ${LIMITE_PROJETOS_RELATORIO} projetos.`)
      .default([])
      .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
    dataInicio: dia.nullable().optional(),
    dataFim: dia.nullable().optional(),
    blocos: z
      .array(z.enum(BLOCOS_RELATORIO, { message: "Bloco de relatório inválido." }))
      .min(1, "Selecione ao menos um bloco.")
      .transform((blocos) => BLOCOS_RELATORIO.filter((bloco) => blocos.includes(bloco))),
  })
  .strict()
  .refine((data) => data.projetoIds.length > 0 || data.dataInicio || data.dataFim, {
    path: ["projetoIds"],
    message: "Informe ao menos um filtro: projetos ou período.",
  })
  .refine((data) => !data.dataInicio || !data.dataFim || data.dataInicio <= data.dataFim, {
    path: ["dataFim"],
    message: "A data final não pode ser anterior à inicial.",
  });
