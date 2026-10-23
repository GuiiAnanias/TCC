import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { dashboardQuerySchema } from "../../schemas/dashboardSchemas.js";
import { dashboardService } from "../../services/dashboardService.js";
import { parseId } from "../../utils/parseId.js";

export const dashboardRoutes = Router();
dashboardRoutes.get("/projetos/:id", asyncHandler(async (request, response) => {
  response.json(await dashboardService.project(parseId(request.params.id), dashboardQuerySchema.parse(request.query)));
}));
dashboardRoutes.get("/colaboradores/:id", asyncHandler(async (request, response) => {
  response.json(await dashboardService.collaborator(parseId(request.params.id), dashboardQuerySchema.parse(request.query)));
}));
dashboardRoutes.get("/opcoes", asyncHandler(async (request, response) => {
  response.json(await dashboardService.options());
}));
dashboardRoutes.get("/", asyncHandler(async (request, response) => {
  response.json(await dashboardService.get(dashboardQuerySchema.parse(request.query)));
}));
