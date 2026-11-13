/**
 * [CONTROLLER] Importação de horas por planilha: modelo, conferência, importação e histórico.
 */

import { z } from "zod";
import { importacaoApontamentosService } from "../../services/importacaoApontamentosService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { enviarPlanilha } from "./relatoriosController.js";

// O corpo da requisição é o próprio arquivo .xlsx (ver `lerArquivo` nas rotas).
const arquivo = (request) => (Buffer.isBuffer(request.body) ? request.body : null);

export const LIMITE_POR_PAGINA_IMPORTACOES = 50;
// [VALIDACAO] Paginação do histórico: página a partir de 1 e no máximo 50 por página.
const historicoSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(LIMITE_POR_PAGINA_IMPORTACOES).default(10),
  })
  .strict();

export const importacoesController = {
  // [CONTROLLER] Baixa o modelo .xlsx com as listas de cadastros ativos.
  modelo: asyncHandler(async (request, response) => {
    enviarPlanilha(response, await importacaoApontamentosService.modelo());
  }),
  // [CONTROLLER] Confere a planilha linha a linha sem gravar nada.
  validar: asyncHandler(async (request, response) => {
    response.json(await importacaoApontamentosService.validar(arquivo(request)));
  }),
  // [CONTROLLER] Importa (tudo ou nada) e registra no histórico, com o nome do arquivo e o usuário.
  importar: asyncHandler(async (request, response) => {
    const resultado = await importacaoApontamentosService.importar(arquivo(request), {
      usuarioId: request.user.id,
      // O navegador manda o nome codificado, para aceitar acentos num cabeçalho HTTP.
      arquivo: request.get("X-Nome-Arquivo"),
    });
    response.status(201).json(resultado);
  }),
  // [CONTROLLER] Histórico das importações, da mais recente para a mais antiga.
  historico: asyncHandler(async (request, response) => {
    response.json(
      await importacaoApontamentosService.historico(historicoSchema.parse(request.query)),
    );
  }),
};
