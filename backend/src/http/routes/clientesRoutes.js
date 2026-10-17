import { Router } from "express";
import { clientesController } from "../controllers/clientesController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const clientesRoutes = Router();
clientesRoutes.get("/cep/:cep", asyncHandler(clientesController.consultarCep));
clientesRoutes.get("/cnpj/:cnpj", asyncHandler(clientesController.consultarCnpj));

clientesRoutes.get("/", asyncHandler(clientesController.index));
clientesRoutes.get("/:id", asyncHandler(clientesController.show));
clientesRoutes.post("/", asyncHandler(clientesController.store));
clientesRoutes.put("/:id", asyncHandler(clientesController.update));
clientesRoutes.delete("/:id", asyncHandler(clientesController.destroy));
