import { Router } from "express";
import { relatoriosController } from "../controllers/relatoriosController.js";
import { authenticate } from "../middlewares/authenticate.js"; // Caso utilize autenticação nas rotas

export const relatoriosRoutes = Router();

// Rota para exportar o Excel (existente)
relatoriosRoutes.get("/indicadores.xlsx", relatoriosController.indicadores);
// Fotografias: gerar grava os dados do recorte; a consulta devolve sempre a mesma cópia.
relatoriosRoutes.post("/", relatoriosController.gerar);
relatoriosRoutes.get("/:id", relatoriosController.buscar);
