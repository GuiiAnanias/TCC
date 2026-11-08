import { Router } from "express";
import { relatoriosController } from "../controllers/relatoriosController.js";
import { authenticate } from "../middlewares/authenticate.js"; // Caso utilize autenticação nas rotas

export const relatoriosRoutes = Router();

// Rota para exportar o Excel (existente)
relatoriosRoutes.get("/indicadores.xlsx", relatoriosController.indicadores);

// Nova rota para obter a Prévia na tela
relatoriosRoutes.get("/previa", relatoriosController.previa);

// Nova rota para persistir a "fotografia" (snapshot) do relatório
relatoriosRoutes.post("/fotografia", relatoriosController.salvarFotografia);
