import { z } from "zod";

export const papeisProjeto = [
  "Product Owner",
  "Scrum Master",
  "Gerente de Projeto",
  "Tech Lead",
  "Líder Técnico",
  "Arquiteto de Software",
  "Analista de Sistemas",
  "Analista de Negócios",
  "Analista de Produto",
  "Desenvolvedor Full Stack",
  "Desenvolvedor Back-end",
  "Desenvolvedor Front-end",
  "Desenvolvedor Mobile",
  "Programador",
  "QA",
  "UI/UX Designer",
  "DevOps",
  "Engenheiro de Dados",
  "DBA",
  "Especialista em Segurança",
  "Suporte Técnico"
];

export const equipeProjetoCreateSchema = z.object({
  colaboradorId: z.coerce.number().int().positive("Colaborador é obrigatório."),
  papel: z.enum(papeisProjeto, { message: "Papel do colaborador inválido." }),
  dataEntrada: z.coerce.date()
});

export const equipeProjetoUpdateSchema = z
  .object({
    papel: z.enum(papeisProjeto, { message: "Papel do colaborador inválido." }).optional(),
    dataEntrada: z.coerce.date().optional(),
    dataSaida: z.coerce.date().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.");
