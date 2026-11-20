/**
 * [ROTA] /api/remuneracoes: tabela de remuneração (nível e valor/hora). DELETE inativa o item.
 */

import { Router } from "express";
import { remuneracoesController } from "../controllers/remuneracoesController.js";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";

export const remuneracoesRoutes = Router();

remuneracoesRoutes.get("/", tratarAssincrono(remuneracoesController.index));
remuneracoesRoutes.get("/:id", tratarAssincrono(remuneracoesController.show));
remuneracoesRoutes.post("/", tratarAssincrono(remuneracoesController.store));
remuneracoesRoutes.put("/:id", tratarAssincrono(remuneracoesController.update));
remuneracoesRoutes.delete("/:id", tratarAssincrono(remuneracoesController.destroy));
