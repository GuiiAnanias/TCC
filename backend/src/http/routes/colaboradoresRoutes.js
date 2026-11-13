/**
 * [ROTA] /api/colaboradores: cadastro de colaboradores e as vigências da configuração financeira
 * (valor/hora) de cada um.
 */

import { Router } from "express";
import { colaboradoresController } from "../controllers/colaboradoresController.js";
import { configuracoesFinanceirasController } from "../controllers/configuracoesFinanceirasController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const colaboradoresRoutes = Router();

// [ROTA] Listagem; as rotas de /:id/configuracoes-financeiras vêm antes das de /:id.
colaboradoresRoutes.get("/", asyncHandler(colaboradoresController.index));
colaboradoresRoutes.get(
  "/:id/configuracoes-financeiras",
  asyncHandler(configuracoesFinanceirasController.index),
);
colaboradoresRoutes.post(
  "/:id/configuracoes-financeiras",
  asyncHandler(configuracoesFinanceirasController.store),
);
colaboradoresRoutes.put(
  "/:id/configuracoes-financeiras/:configuracaoId",
  asyncHandler(configuracoesFinanceirasController.update),
);
colaboradoresRoutes.delete(
  "/:id/configuracoes-financeiras/:configuracaoId",
  asyncHandler(configuracoesFinanceirasController.destroy),
);
// [ROTA] CRUD do colaborador (DELETE inativa).
colaboradoresRoutes.get("/:id", asyncHandler(colaboradoresController.show));
colaboradoresRoutes.post("/", asyncHandler(colaboradoresController.store));
colaboradoresRoutes.put("/:id", asyncHandler(colaboradoresController.update));
colaboradoresRoutes.delete("/:id", asyncHandler(colaboradoresController.destroy));
