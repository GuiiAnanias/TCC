import { z } from "zod";
import { importacaoApontamentosService } from "../../services/importacaoApontamentosService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { enviarPlanilha } from "./relatoriosController.js";

// O corpo da requisição é o próprio arquivo .xlsx (ver `lerArquivo` nas rotas).
const arquivo = (request) => (Buffer.isBuffer(request.body) ? request.body : null);

export const LIMITE_POR_PAGINA_IMPORTACOES = 50;
const historicoSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(LIMITE_POR_PAGINA_IMPORTACOES).default(10),
  })
  .strict();

export const importacoesController = {
  modelo: asyncHandler(async (request, response) => {
    enviarPlanilha(response, await importacaoApontamentosService.modelo());
  }),
  validar: asyncHandler(async (request, response) => {
    response.json(await importacaoApontamentosService.validar(arquivo(request)));
  }),
  importar: asyncHandler(async (request, response) => {
    const resultado = await importacaoApontamentosService.importar(arquivo(request), {
      usuarioId: request.user.id,
      // O navegador manda o nome codificado, para aceitar acentos num cabeçalho HTTP.
      arquivo: request.get("X-Nome-Arquivo"),
    });
    response.status(201).json(resultado);
  }),
  historico: asyncHandler(async (request, response) => {
    response.json(
      await importacaoApontamentosService.historico(historicoSchema.parse(request.query)),
    );
  }),
};
