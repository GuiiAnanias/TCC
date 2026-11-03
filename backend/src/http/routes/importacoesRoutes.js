import express, { Router } from "express";
import { importacoesController } from "../controllers/importacoesController.js";
import { TAMANHO_MAXIMO } from "../../services/importacaoApontamentosService.js";
import { HttpError } from "../../utils/HttpError.js";

const leitorBruto = express.raw({ type: () => true, limit: TAMANHO_MAXIMO });

// Recebe o .xlsx como corpo binário, sem formulário multipart.
function lerArquivo(request, response, next) {
  leitorBruto(request, response, (error) => {
    if (error?.type === "entity.too.large")
      return next(
        new HttpError(413, "O arquivo passa de 5 MB. Divida os apontamentos em mais arquivos."),
      );
    next(error);
  });
}

export const importacoesRoutes = Router();
importacoesRoutes.get("/apontamentos/modelo", importacoesController.modelo);
// Só confere a planilha e devolve os erros por linha; não grava nada.
importacoesRoutes.post("/apontamentos/validacao", lerArquivo, importacoesController.validar);
// Grava todos os apontamentos ou nenhum.
importacoesRoutes.post("/apontamentos", lerArquivo, importacoesController.importar);
