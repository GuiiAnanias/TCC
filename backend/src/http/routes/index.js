import { Router } from "express";
import { clientesRoutes } from "./clientesRoutes.js";
import { colaboradoresRoutes } from "./colaboradoresRoutes.js";
import { remuneracoesRoutes } from "./remuneracoesRoutes.js";
import { projetosRoutes } from "./projetosRoutes.js";

export const routes = Router();

routes.get("/health", (request, response) => {
  response.json({
    status: "ok",
    service: "sistema-indicadores-api"
  });
});

routes.use("/clientes", clientesRoutes);
routes.use("/colaboradores", colaboradoresRoutes);
routes.use("/remuneracoes", remuneracoesRoutes);
routes.use("/projetos", projetosRoutes);
