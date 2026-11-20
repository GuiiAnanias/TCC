/**
 * [ROTA] /api/importacoes/apontamentos: modelo .xlsx, conferência sem gravar, importação (tudo ou
 * nada) e histórico das importações.
 */

import express, { Router } from "express";
import { importacoesController } from "../controllers/importacoesController.js";
import { TAMANHO_MAXIMO } from "../../services/importacaoApontamentosService.js";
import { ErroHttp } from "../../utils/ErroHttp.js";

// [VALIDACAO] O corpo é o próprio arquivo, lido como bytes, com tamanho máximo; acima disso
// responde 413.
const leitorBruto = express.raw({ type: () => true, limit: TAMANHO_MAXIMO });

// Recebe o .xlsx como corpo binário, sem formulário multipart.
function lerArquivo(request, response, next) {
  leitorBruto(request, response, (error) => {
    if (error?.type === "entity.too.large")
      return next(
        new ErroHttp(413, "O arquivo passa de 5 MB. Divida os apontamentos em mais arquivos."),
      );
    next(error);
  });
}

export const importacoesRoutes = Router();
importacoesRoutes.get("/apontamentos/modelo", importacoesController.modelo);
// Histórico das importações, da mais recente para a mais antiga (concluídas e com falha).
importacoesRoutes.get("/apontamentos/historico", importacoesController.historico);
// Só confere a planilha e devolve os erros por linha; não grava nada.
importacoesRoutes.post("/apontamentos/validacao", lerArquivo, importacoesController.validar);
// Grava todos os apontamentos ou nenhum, e registra a tentativa no histórico.
importacoesRoutes.post("/apontamentos", lerArquivo, importacoesController.importar);
