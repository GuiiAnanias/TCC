/**
 * [ROTA] /api/clientes: cadastro de clientes PF e PJ e as consultas de CNPJ (ReceitaWS) e CEP
 * (ViaCEP).
 */

import { Router } from "express";
import { clientesController } from "../controllers/clientesController.js";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";

export const clientesRoutes = Router();
// [API-EXTERNA] Consultas que só preenchem o formulário; nada é gravado.
clientesRoutes.get("/cep/:cep", tratarAssincrono(clientesController.consultarCep));
clientesRoutes.get("/cnpj/:cnpj", tratarAssincrono(clientesController.consultarCnpj));

// [ROTA] CRUD: listar, buscar, cadastrar, editar e inativar (DELETE inativa).
clientesRoutes.get("/", tratarAssincrono(clientesController.index));
clientesRoutes.get("/:id", tratarAssincrono(clientesController.show));
clientesRoutes.post("/", tratarAssincrono(clientesController.store));
clientesRoutes.put("/:id", tratarAssincrono(clientesController.update));
clientesRoutes.delete("/:id", tratarAssincrono(clientesController.destroy));
