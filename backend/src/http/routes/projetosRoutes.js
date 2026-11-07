import { Router } from "express";
import { projetosController } from "../controllers/projetosController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const projetosRoutes = Router();

projetosRoutes.get("/papeis", asyncHandler(projetosController.roles));
projetosRoutes.get("/", asyncHandler(projetosController.index));
projetosRoutes.post("/", asyncHandler(projetosController.store));
projetosRoutes.get("/:id/exclusao", asyncHandler(projetosController.deletionInfo));
projetosRoutes.delete("/:id/permanente", asyncHandler(projetosController.deletePermanently));
projetosRoutes.get("/:id", asyncHandler(projetosController.show));
projetosRoutes.put("/:id", asyncHandler(projetosController.update));
projetosRoutes.delete("/:id", asyncHandler(projetosController.destroy));
projetosRoutes.get("/:id/equipe", asyncHandler(projetosController.listTeam));
projetosRoutes.post("/:id/equipe", asyncHandler(projetosController.addTeamMember));
projetosRoutes.put("/:id/equipe/:vinculoId", asyncHandler(projetosController.updateTeamMember));
projetosRoutes.delete("/:id/equipe/:vinculoId", asyncHandler(projetosController.removeTeamMember));
