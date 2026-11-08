import { Router } from "express";
import { relatoriosController } from "../controllers/relatoriosController.js";

export const relatoriosRoutes = Router();

// Rota para exportar o Excel (existente)
relatoriosRoutes.get("/indicadores.xlsx", relatoriosController.indicadores);
// Fotografias: gerar grava os dados do recorte; a consulta devolve sempre a mesma cópia.
relatoriosRoutes.post("/", relatoriosController.gerar);
// Histórico: página dos relatórios gerados, com autor, filtros e formatos baixados.
relatoriosRoutes.get("/", relatoriosController.listar);
// Arquivos da fotografia: PDF e Excel com os mesmos números da prévia.
relatoriosRoutes.get("/:id/pdf", relatoriosController.pdf);
relatoriosRoutes.get("/:id/xlsx", relatoriosController.xlsx);
relatoriosRoutes.get("/:id", relatoriosController.buscar);
