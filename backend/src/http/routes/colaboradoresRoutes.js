/**
 * [ROTA] /api/colaboradores: cadastro de colaboradores e as vigências da configuração financeira
 * (valor/hora) de cada um.
 */

import { Router } from "express";
import { colaboradoresController } from "../controllers/colaboradoresController.js";
import { configuracoesFinanceirasController } from "../controllers/configuracoesFinanceirasController.js";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";

export const colaboradoresRoutes = Router();

// [ROTA] Listagem; as rotas de /:id/configuracoes-financeiras vêm antes das de /:id.
colaboradoresRoutes.get("/", tratarAssincrono(colaboradoresController.index));
colaboradoresRoutes.get(
  "/:id/configuracoes-financeiras",
  tratarAssincrono(configuracoesFinanceirasController.index),
);
colaboradoresRoutes.post(
  "/:id/configuracoes-financeiras",
  tratarAssincrono(configuracoesFinanceirasController.store),
);
colaboradoresRoutes.put(
  "/:id/configuracoes-financeiras/:configuracaoId",
  tratarAssincrono(configuracoesFinanceirasController.update),
);
colaboradoresRoutes.delete(
  "/:id/configuracoes-financeiras/:configuracaoId",
  tratarAssincrono(configuracoesFinanceirasController.destroy),
);
// [ROTA] CRUD do colaborador (DELETE inativa).
colaboradoresRoutes.get("/:id", tratarAssincrono(colaboradoresController.show));
colaboradoresRoutes.post("/", tratarAssincrono(colaboradoresController.store));
colaboradoresRoutes.put("/:id", tratarAssincrono(colaboradoresController.update));
colaboradoresRoutes.delete("/:id", tratarAssincrono(colaboradoresController.destroy));
