import { Router } from "express";
import { colaboradoresController } from "../controllers/colaboradoresController.js";
import { configuracoesFinanceirasController } from "../controllers/configuracoesFinanceirasController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const colaboradoresRoutes = Router();

colaboradoresRoutes.get("/", asyncHandler(colaboradoresController.index));
colaboradoresRoutes.get("/:id/configuracoes-financeiras", asyncHandler(configuracoesFinanceirasController.index));
colaboradoresRoutes.post("/:id/configuracoes-financeiras", asyncHandler(configuracoesFinanceirasController.store));
colaboradoresRoutes.put(
  "/:id/configuracoes-financeiras/:configuracaoId",
  asyncHandler(configuracoesFinanceirasController.update)
);
colaboradoresRoutes.delete(
  "/:id/configuracoes-financeiras/:configuracaoId",
  asyncHandler(configuracoesFinanceirasController.destroy)
);
colaboradoresRoutes.get("/:id", asyncHandler(colaboradoresController.show));
colaboradoresRoutes.post("/", asyncHandler(colaboradoresController.store));
colaboradoresRoutes.put("/:id", asyncHandler(colaboradoresController.update));
colaboradoresRoutes.delete("/:id", asyncHandler(colaboradoresController.destroy));
