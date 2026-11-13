/**
 * [ROTA] /api/bonificacoes-papeis: percentual de bonificação por papel no projeto, com data de
 * início (regras versionadas, sem edição).
 */

import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { bonificacaoPapelCreateSchema } from "../../schemas/bonificacoesPapeisSchemas.js";
import { bonificacoesPapeisRepository } from "../../repositories/bonificacoesPapeisRepository.js";

export const bonificacoesPapeisRoutes = Router();
bonificacoesPapeisRoutes.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(await bonificacoesPapeisRepository.findAll());
  }),
);
bonificacoesPapeisRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(
        await bonificacoesPapeisRepository.createVersion(
          bonificacaoPapelCreateSchema.parse(request.body),
        ),
      );
  }),
);
