/**
 * [ROTA] /api/projetos: cadastro de projetos, equipe do projeto (papéis e períodos) e exclusão
 * definitiva.
 */

import { Router } from "express";
import { projetosController } from "../controllers/projetosController.js";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";

export const projetosRoutes = Router();

// [ROTA] Catálogo de papéis no projeto (Dev, PO, QA...). Fica antes de /:id para não ser lido como
// id.
projetosRoutes.get("/papeis", tratarAssincrono(projetosController.roles));
projetosRoutes.get("/", tratarAssincrono(projetosController.index));
projetosRoutes.post("/", tratarAssincrono(projetosController.store));
// [ROTA] Exclusão definitiva: primeiro consulta os vínculos, depois apaga só se não houver nenhum.
projetosRoutes.get("/:id/exclusao", tratarAssincrono(projetosController.deletionInfo));
projetosRoutes.delete("/:id/permanente", tratarAssincrono(projetosController.deletePermanently));
projetosRoutes.get("/:id", tratarAssincrono(projetosController.show));
projetosRoutes.put("/:id", tratarAssincrono(projetosController.update));
projetosRoutes.delete("/:id", tratarAssincrono(projetosController.destroy));
// [ROTA] Equipe do projeto: listar, vincular, trocar papel ou datas e encerrar participação.
projetosRoutes.get("/:id/equipe", tratarAssincrono(projetosController.listTeam));
projetosRoutes.post("/:id/equipe", tratarAssincrono(projetosController.addTeamMember));
projetosRoutes.put("/:id/equipe/:vinculoId", tratarAssincrono(projetosController.updateTeamMember));
projetosRoutes.delete(
  "/:id/equipe/:vinculoId",
  tratarAssincrono(projetosController.removeTeamMember),
);
