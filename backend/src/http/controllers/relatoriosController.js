import { relatoriosService } from "../../services/relatoriosService.js";
import { dashboardQuerySchema } from "../../schemas/dashboardSchemas.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { XLSX_MIME } from "../../utils/planilha.js";

export function enviarPlanilha(response, { arquivo, nome }) {
  response
    .status(200)
    .set({
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    })
    .send(arquivo);
}

export const relatoriosController = {
  indicadores: asyncHandler(async (request, response) => {
    const filtros = dashboardQuerySchema.parse(request.query);
    enviarPlanilha(response, await relatoriosService.indicadoresXlsx(filtros));
  }),
};
