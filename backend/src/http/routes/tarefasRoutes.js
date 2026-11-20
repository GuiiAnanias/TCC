/**
 * [ROTA] /api/tarefas e /api/sprints: tarefas e sprints de cada projeto. Não há DELETE: tarefas e
 * sprints são arquivadas pela edição (statusRegistro).
 */

import { Router } from "express";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";
import { lerId } from "../../utils/lerId.js";
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
  tratarAssincrono(async (req, res) =>
    res.json(await tarefasRepository.findAll(tarefaQuerySchema.parse(req.query))),
  ),
);
tarefasRoutes.post(
  "/",
  tratarAssincrono(async (req, res) =>
    res.status(201).json(await tarefasRepository.save(null, tarefaCreateSchema.parse(req.body))),
  ),
);
tarefasRoutes.put(
  "/:id",
  tratarAssincrono(async (req, res) =>
    res.json(
      await tarefasRepository.save(lerId(req.params.id), tarefaUpdateSchema.parse(req.body)),
    ),
  ),
);
sprintsRoutes.get(
  "/",
  tratarAssincrono(async (req, res) =>
    res.json(await tarefasRepository.listSprints(sprintQuerySchema.parse(req.query))),
  ),
);
sprintsRoutes.post(
  "/",
  tratarAssincrono(async (req, res) =>
    res
      .status(201)
      .json(await tarefasRepository.saveSprint(null, sprintCreateSchema.parse(req.body))),
  ),
);
sprintsRoutes.put(
  "/:id",
  tratarAssincrono(async (req, res) =>
    res.json(
      await tarefasRepository.saveSprint(lerId(req.params.id), sprintUpdateSchema.parse(req.body)),
    ),
  ),
);
