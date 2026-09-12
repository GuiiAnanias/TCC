import { Router } from "express";
import { clientesController } from "../controllers/clientesController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const clientesRoutes = Router();

clientesRoutes.get("/", asyncHandler(clientesController.index));
clientesRoutes.get("/:id", asyncHandler(clientesController.show));
clientesRoutes.post("/", asyncHandler(clientesController.store));
clientesRoutes.put("/:id", asyncHandler(clientesController.update));
clientesRoutes.delete("/:id", asyncHandler(clientesController.destroy));
