/**
 * [ROTA] /api/remuneracoes: tabela de remuneração (nível e valor/hora). DELETE inativa o item.
 */

import { Router } from "express";
import { remuneracoesController } from "../controllers/remuneracoesController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const remuneracoesRoutes = Router();

remuneracoesRoutes.get("/", asyncHandler(remuneracoesController.index));
remuneracoesRoutes.get("/:id", asyncHandler(remuneracoesController.show));
remuneracoesRoutes.post("/", asyncHandler(remuneracoesController.store));
remuneracoesRoutes.put("/:id", asyncHandler(remuneracoesController.update));
remuneracoesRoutes.delete("/:id", asyncHandler(remuneracoesController.destroy));
