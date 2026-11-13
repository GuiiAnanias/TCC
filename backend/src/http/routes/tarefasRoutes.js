/**
 * [ROTA] /api/tarefas e /api/sprints: tarefas e sprints de cada projeto. Não há DELETE: tarefas e
 * sprints são arquivadas pela edição (statusRegistro).
 */

import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseId } from "../../utils/parseId.js";
import { tarefasRepository } from "../../repositories/tarefasRepository.js";
import {
  tarefaCreateSchema,
  tarefaUpdateSchema,
  tarefaQuerySchema,
  sprintCreateSchema,
  sprintUpdateSchema,
  sprintQuerySchema,
} from "../../schemas/tarefasSchemas.js";

export const tarefasRoutes = Router();
export const sprintsRoutes = Router();
tarefasRoutes.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json(await tarefasRepository.findAll(tarefaQuerySchema.parse(req.query))),
  ),
);
tarefasRoutes.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json(await tarefasRepository.save(null, tarefaCreateSchema.parse(req.body))),
  ),
);
tarefasRoutes.put(
  "/:id",
  asyncHandler(async (req, res) =>
    res.json(
      await tarefasRepository.save(parseId(req.params.id), tarefaUpdateSchema.parse(req.body)),
    ),
  ),
);
sprintsRoutes.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json(await tarefasRepository.listSprints(sprintQuerySchema.parse(req.query))),
  ),
);
sprintsRoutes.post(
  "/",
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json(await tarefasRepository.saveSprint(null, sprintCreateSchema.parse(req.body))),
  ),
);
sprintsRoutes.put(
  "/:id",
  asyncHandler(async (req, res) =>
    res.json(
      await tarefasRepository.saveSprint(
        parseId(req.params.id),
        sprintUpdateSchema.parse(req.body),
      ),
    ),
  ),
);
