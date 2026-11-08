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

  // Novo método para exibir a Prévia na tela
  previa: asyncHandler(async (request, response) => {
    const filtros = dashboardQuerySchema.parse(request.query);
    const dadosPrevia = await relatoriosService.obterPrevia(filtros);
    response.status(200).json(dadosPrevia);
  }),

  // Novo método para persistir a "fotografia" do relatório gerado
  salvarFotografia: asyncHandler(async (request, response) => {
    const filtros = dashboardQuerySchema.parse(request.body.filtros || {});
    const dadosRelatorio = await relatoriosService.obterPrevia(filtros);
    const usuarioId = request.usuario?.id || null; // Ajustado conforme o middleware de autenticação existente

    const historico = await relatoriosService.salvarFotografia(usuarioId, filtros, dadosRelatorio);
    response.status(201).json({
      sucesso: true,
      mensagem: "Fotografia do relatório salva com sucesso.",
      id: historico.id,
    });
  }),
};