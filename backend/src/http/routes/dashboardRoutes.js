/**
 * [ROTA] /api/dashboard: indicadores do Dashboard Geral, dashboards por projeto e por colaborador e
 * as opções dos filtros. [VALIDACAO] Os filtros da URL passam pelo dashboardQuerySchema.
 */

import { Router } from "express";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";
import { dashboardQuerySchema } from "../../schemas/dashboardSchemas.js";
import { dashboardService } from "../../services/dashboardService.js";
import { lerId } from "../../utils/lerId.js";

export const dashboardRoutes = Router();
dashboardRoutes.get(
  "/projetos/:id",
  tratarAssincrono(async (request, response) => {
    response.json(
      await dashboardService.project(
        lerId(request.params.id),
        dashboardQuerySchema.parse(request.query),
      ),
    );
  }),
);
dashboardRoutes.get(
  "/colaboradores/:id",
  tratarAssincrono(async (request, response) => {
    response.json(
      await dashboardService.collaborator(
        lerId(request.params.id),
        dashboardQuerySchema.parse(request.query),
      ),
    );
  }),
);
dashboardRoutes.get(
  "/opcoes",
  tratarAssincrono(async (request, response) => {
    response.json(await dashboardService.options());
  }),
);
dashboardRoutes.get(
  "/",
  tratarAssincrono(async (request, response) => {
    response.json(await dashboardService.get(dashboardQuerySchema.parse(request.query)));
  }),
);
