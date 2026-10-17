import { Router } from "express";
import { clientesRoutes } from "./clientesRoutes.js";
import { colaboradoresRoutes } from "./colaboradoresRoutes.js";
import { remuneracoesRoutes } from "./remuneracoesRoutes.js";
import { projetosRoutes } from "./projetosRoutes.js";
import { apontamentosRoutes } from "./apontamentosRoutes.js";
import { departamentosTi, funcoesTi } from "../../schemas/cadastroOptions.js";
import { authRoutes } from "./authRoutes.js";
import { authenticate } from "../middlewares/authenticate.js";

export const routes = Router();

routes.get("/health", (request, response) => {
  response.json({
    status: "ok",
    service: "sistema-indicadores-api"
  });
});

routes.use("/auth", authRoutes);
routes.use(authenticate);
routes.get("/opcoes-cadastro", (request, response) => {
  response.json({ funcoes: funcoesTi, departamentos: departamentosTi });
});
routes.use("/clientes", clientesRoutes);
routes.use("/colaboradores", colaboradoresRoutes);
routes.use("/remuneracoes", remuneracoesRoutes);
routes.use("/projetos", projetosRoutes);
routes.use("/apontamentos", apontamentosRoutes);
