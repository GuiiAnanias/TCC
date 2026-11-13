/**
 * [ROTA] /api/apontamentos: horas trabalhadas (listar, buscar, lançar, editar e excluir).
 */

import { Router } from "express";
import { apontamentosController } from "../controllers/apontamentosController.js";
export const apontamentosRoutes = Router();
apontamentosRoutes.get("/", apontamentosController.list);
apontamentosRoutes.post("/", apontamentosController.create);
apontamentosRoutes.get("/:id", apontamentosController.getById);
apontamentosRoutes.put("/:id", apontamentosController.update);
apontamentosRoutes.delete("/:id", apontamentosController.remove);
