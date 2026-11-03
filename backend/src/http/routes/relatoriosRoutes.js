import { Router } from "express";
import { relatoriosController } from "../controllers/relatoriosController.js";

export const relatoriosRoutes = Router();
// Mesmos filtros do GET /api/dashboard.
relatoriosRoutes.get("/indicadores.xlsx", relatoriosController.indicadores);
