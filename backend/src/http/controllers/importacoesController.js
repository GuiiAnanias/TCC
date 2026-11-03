import { importacaoApontamentosService } from "../../services/importacaoApontamentosService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { enviarPlanilha } from "./relatoriosController.js";

// O corpo da requisição é o próprio arquivo .xlsx (ver `lerArquivo` nas rotas).
const arquivo = (request) => (Buffer.isBuffer(request.body) ? request.body : null);

export const importacoesController = {
  modelo: asyncHandler(async (request, response) => {
    enviarPlanilha(response, await importacaoApontamentosService.modelo());
  }),
  validar: asyncHandler(async (request, response) => {
    response.json(await importacaoApontamentosService.validar(arquivo(request)));
  }),
  importar: asyncHandler(async (request, response) => {
    response.status(201).json(await importacaoApontamentosService.importar(arquivo(request)));
  }),
};
