/**
 * [ROTA] /api/premiacoes: modelos, regras publicadas e avaliações de premiação (rascunho, conclusão
 * e reavaliação).
 */

import { Router } from "express";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";
import { lerId } from "../../utils/lerId.js";
import { premiacaoRepository as repository } from "../../repositories/premiacaoRepository.js";
import {
  awardRuleSchema,
  awardCreateSchema,
  awardUpdateSchema,
  awardCloseSchema,
  awardQuerySchema,
  awardProjectsQuerySchema,
} from "../../schemas/premiacaoSchemas.js";
export const premiacaoRoutes = Router();
premiacaoRoutes.get("/modelos", (req, res) => res.json(repository.templates()));
premiacaoRoutes.get(
  "/regras",
  tratarAssincrono(async (req, res) => res.json(await repository.rules())),
);
premiacaoRoutes.post(
  "/regras",
  tratarAssincrono(async (req, res) =>
    res.status(201).json(await repository.createRule(awardRuleSchema.parse(req.body), req.user)),
  ),
);
premiacaoRoutes.get(
  "/",
  tratarAssincrono(async (req, res) =>
    res.json(await repository.list(awardQuerySchema.parse(req.query))),
  ),
);
// Antes de "/:id": projetos que podem entrar na avaliação da pessoa naquela competência.
premiacaoRoutes.get(
  "/projetos",
  tratarAssincrono(async (req, res) =>
    res.json(await repository.projectsForPerson(awardProjectsQuerySchema.parse(req.query))),
  ),
);
premiacaoRoutes.get(
  "/:id",
  tratarAssincrono(async (req, res) => res.json(await repository.find(lerId(req.params.id)))),
);
premiacaoRoutes.post(
  "/",
  tratarAssincrono(async (req, res) =>
    res.status(201).json(await repository.create(awardCreateSchema.parse(req.body), req.user)),
  ),
);
premiacaoRoutes.put(
  "/:id",
  tratarAssincrono(async (req, res) =>
    res.json(
      await repository.update(lerId(req.params.id), awardUpdateSchema.parse(req.body), req.user),
    ),
  ),
);
premiacaoRoutes.post(
  "/:id/concluir",
  tratarAssincrono(async (req, res) =>
    res.json(
      await repository.close(lerId(req.params.id), awardCloseSchema.parse(req.body), req.user),
    ),
  ),
);
