/**
 * [CONTROLLER] Relatórios: gera, lista, abre e baixa (PDF e Excel). Os arquivos são montados a cada
 * download a partir da cópia gravada.
 */

import { relatoriosService } from "../../services/relatoriosService.js";
import { relatoriosGeradosService } from "../../services/relatoriosGeradosService.js";
import { relatoriosArquivosService } from "../../services/relatoriosArquivosService.js";
import { dashboardQuerySchema } from "../../schemas/dashboardSchemas.js";
import { relatorioCreateSchema, relatorioListaSchema } from "../../schemas/relatoriosSchemas.js";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";
import { lerId } from "../../utils/lerId.js";
import { XLSX_MIME } from "../../utils/planilha.js";

// Responde um arquivo para download, com o nome no Content-Disposition e sem cache.
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
  // [CONTROLLER] Excel do Dashboard Geral. [VALIDACAO] Mesmos filtros da tela
  // (dashboardQuerySchema).
  indicadores: tratarAssincrono(async (request, response) => {
    const filtros = dashboardQuerySchema.parse(request.query);
    enviarPlanilha(response, await relatoriosService.indicadoresXlsx(filtros));
  }),
  // [CONTROLLER] Gera e grava o relatório. [VALIDACAO] relatorioCreateSchema exige ao menos um
  // filtro e um bloco.
  gerar: tratarAssincrono(async (request, response) => {
    const dados = relatorioCreateSchema.parse(request.body);
    response.status(201).json(await relatoriosGeradosService.gerar(dados, request.user));
  }),
  // [CONTROLLER] Prévia do relatório sem gravar no histórico. [VALIDACAO] Mesmas regras de gerar.
  previa: tratarAssincrono(async (request, response) => {
    const dados = relatorioCreateSchema.parse(request.body);
    response.json(await relatoriosGeradosService.previa(dados, request.user));
  }),
  // [CONTROLLER] Download em PDF; registra a exportação no histórico.
  pdf: tratarAssincrono(async (request, response) => {
    const { arquivo, nome } = await relatoriosArquivosService.pdf(
      lerId(request.params.id, "relatório"),
      request.user,
    );
    enviarArquivo(response, { arquivo, nome, tipo: "application/pdf" });
  }),
  xlsx: tratarAssincrono(async (request, response) => {
    enviarPlanilha(
      response,
      await relatoriosArquivosService.xlsx(lerId(request.params.id, "relatório"), request.user),
    );
  }),
  listar: tratarAssincrono(async (request, response) => {
    response.json(await relatoriosGeradosService.listar(relatorioListaSchema.parse(request.query)));
  }),
  buscar: tratarAssincrono(async (request, response) => {
    response.json(await relatoriosGeradosService.buscar(lerId(request.params.id, "relatório")));
  }),
};
