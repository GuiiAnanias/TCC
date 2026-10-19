import { Router } from "express";
import { clientesRoutes } from "./clientesRoutes.js";
import { colaboradoresRoutes } from "./colaboradoresRoutes.js";
import { remuneracoesRoutes } from "./remuneracoesRoutes.js";
import { projetosRoutes } from "./projetosRoutes.js";
import { apontamentosRoutes } from "./apontamentosRoutes.js";
import { departamentosTi, cargosTi, niveisRemuneracao, papeisProjeto } from "../../schemas/cadastroOptions.js";
import { authRoutes } from "./authRoutes.js";
import { authenticate } from "../middlewares/authenticate.js";
import { bonificacoesPapeisRoutes } from "./bonificacoesPapeisRoutes.js";

export const routes = Router();

routes.get("/health", (request, response) => {
  response.json({
    status: "ok",
    service: "sistema-indicadores-api"
  });
});

routes.use("/auth", authRoutes);
routes.use(authenticate);
routes.use("/bonificacoes-papeis", bonificacoesPapeisRoutes);
routes.get("/opcoes-cadastro", (request, response) => {
  // `funcoes` é apenas um alias de compatibilidade para clientes antigos da API.
  response.json({ cargos: cargosTi, niveisRemuneracao, papeisProjeto, departamentos: departamentosTi, funcoes: cargosTi });
});
routes.use("/clientes", clientesRoutes);
routes.use("/colaboradores", colaboradoresRoutes);
routes.use("/remuneracoes", remuneracoesRoutes);
routes.use("/projetos", projetosRoutes);
routes.use("/apontamentos", apontamentosRoutes);
