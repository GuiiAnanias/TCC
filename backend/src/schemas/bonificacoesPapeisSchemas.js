import { z } from "zod";
import { papeisProjeto } from "./equipeProjetoSchemas.js";

export const bonificacaoPapelCreateSchema = z.object({
  papel: z.enum(papeisProjeto, { message: "Selecione um papel válido." }),
  percentual: z.preprocess((value) => value === "" || value === null ? undefined : value,
    z.coerce.number().finite().min(0, "Percentual não pode ser negativo.").max(99999999.99).multipleOf(0.01, "Use no máximo duas casas decimais.")),
  dataInicio: z.string().date().transform((value) => new Date(`${value}T00:00:00.000Z`))
});
