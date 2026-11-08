import { relatoriosService } from "../../services/relatoriosService.js";
import { relatoriosGeradosService } from "../../services/relatoriosGeradosService.js";
import { relatoriosArquivosService } from "../../services/relatoriosArquivosService.js";
import { dashboardQuerySchema } from "../../schemas/dashboardSchemas.js";
import { relatorioCreateSchema } from "../../schemas/relatoriosSchemas.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseId } from "../../utils/parseId.js";
import { XLSX_MIME } from "../../utils/planilha.js";

export function enviarArquivo(response, { arquivo, nome, tipo }) {
  response
    .status(200)
    .set({
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    })
    .send(arquivo);
}

export function enviarPlanilha(response, { arquivo, nome }) {
  enviarArquivo(response, { arquivo, nome, tipo: XLSX_MIME });
}

export const relatoriosController = {
  indicadores: asyncHandler(async (request, response) => {
    const filtros = dashboardQuerySchema.parse(request.query);
    enviarPlanilha(response, await relatoriosService.indicadoresXlsx(filtros));
  }),
  gerar: asyncHandler(async (request, response) => {
    const dados = relatorioCreateSchema.parse(request.body);
    response.status(201).json(await relatoriosGeradosService.gerar(dados, request.user));
  }),
  pdf: asyncHandler(async (request, response) => {
    const { arquivo, nome } = await relatoriosArquivosService.pdf(
      parseId(request.params.id, "relatório"),
    );
    enviarArquivo(response, { arquivo, nome, tipo: "application/pdf" });
  }),
  xlsx: asyncHandler(async (request, response) => {
    enviarPlanilha(
      response,
      await relatoriosArquivosService.xlsx(parseId(request.params.id, "relatório")),
    );
  }),
  buscar: asyncHandler(async (request, response) => {
    response.json(await relatoriosGeradosService.buscar(parseId(request.params.id, "relatório")));
  }),
};
