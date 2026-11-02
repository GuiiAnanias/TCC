import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseId } from "../../utils/parseId.js";
import { premiacaoRepository as repository } from "../../repositories/premiacaoRepository.js";
import {
  awardRuleSchema,
  awardCreateSchema,
  awardUpdateSchema,
  awardCloseSchema,
  awardQuerySchema,
} from "../../schemas/premiacaoSchemas.js";
export const premiacaoRoutes = Router();
premiacaoRoutes.get("/modelos", (req, res) => res.json(repository.templates()));
premiacaoRoutes.get(
  "/regras",
  asyncHandler(async (req, res) => res.json(await repository.rules())),
);
premiacaoRoutes.post(
  "/regras",
  asyncHandler(async (req, res) =>
    res.status(201).json(await repository.createRule(awardRuleSchema.parse(req.body), req.user)),
  ),
);
premiacaoRoutes.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json(await repository.list(awardQuerySchema.parse(req.query))),
  ),
);
premiacaoRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => res.json(await repository.find(parseId(req.params.id)))),
);
premiacaoRoutes.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json(await repository.create(awardCreateSchema.parse(req.body), req.user)),
  ),
);
premiacaoRoutes.put(
  "/:id",
  asyncHandler(async (req, res) =>
    res.json(
      await repository.update(parseId(req.params.id), awardUpdateSchema.parse(req.body), req.user),
    ),
  ),
);
premiacaoRoutes.post(
  "/:id/concluir",
  asyncHandler(async (req, res) =>
    res.json(
      await repository.close(parseId(req.params.id), awardCloseSchema.parse(req.body), req.user),
    ),
  ),
);
