import { Router } from "express";
import { relatoriosController } from "../controllers/relatoriosController.js";

export const relatoriosRoutes = Router();
// Mesmos filtros do GET /api/dashboard.
relatoriosRoutes.get("/indicadores.xlsx", relatoriosController.indicadores);
// Fotografias: gerar grava os dados do recorte; a consulta devolve sempre a mesma cópia.
relatoriosRoutes.post("/", relatoriosController.gerar);
relatoriosRoutes.get("/:id", relatoriosController.buscar);
