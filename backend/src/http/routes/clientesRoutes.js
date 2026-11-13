/**
 * [ROTA] /api/clientes: cadastro de clientes PF e PJ e as consultas de CNPJ (ReceitaWS) e CEP
 * (ViaCEP).
 */

import { Router } from "express";
import { clientesController } from "../controllers/clientesController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const clientesRoutes = Router();
// [API-EXTERNA] Consultas que só preenchem o formulário; nada é gravado.
clientesRoutes.get("/cep/:cep", asyncHandler(clientesController.consultarCep));
clientesRoutes.get("/cnpj/:cnpj", asyncHandler(clientesController.consultarCnpj));

// [ROTA] CRUD: listar, buscar, cadastrar, editar e inativar (DELETE inativa).
clientesRoutes.get("/", asyncHandler(clientesController.index));
clientesRoutes.get("/:id", asyncHandler(clientesController.show));
clientesRoutes.post("/", asyncHandler(clientesController.store));
clientesRoutes.put("/:id", asyncHandler(clientesController.update));
clientesRoutes.delete("/:id", asyncHandler(clientesController.destroy));
