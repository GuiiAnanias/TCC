import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { dashboardQuerySchema } from "../../schemas/dashboardSchemas.js";
import { dashboardService } from "../../services/dashboardService.js";

export const dashboardRoutes = Router();
dashboardRoutes.get("/opcoes", asyncHandler(async (request, response) => {
  response.json(await dashboardService.options());
}));
dashboardRoutes.get("/", asyncHandler(async (request, response) => {
  response.json(await dashboardService.get(dashboardQuerySchema.parse(request.query)));
}));
