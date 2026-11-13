/**
 * [ROTA] Registro de todas as rotas da API (/api/...). Rotas públicas ficam antes de
 * routes.use(authenticate); todas as demais exigem login.
 */

import { premiacaoRoutes } from "./premiacaoRoutes.js";
import { dashboardRoutes } from "./dashboardRoutes.js";
import { tarefasRoutes, sprintsRoutes } from "./tarefasRoutes.js";
import { Router } from "express";
import { clientesRoutes } from "./clientesRoutes.js";
import { colaboradoresRoutes } from "./colaboradoresRoutes.js";
import { remuneracoesRoutes } from "./remuneracoesRoutes.js";
import { projetosRoutes } from "./projetosRoutes.js";
import { apontamentosRoutes } from "./apontamentosRoutes.js";
import {
  departamentosTi,
  cargosTi,
  niveisRemuneracao,
  papeisProjeto,
} from "../../schemas/cadastroOptions.js";
import { authRoutes } from "./authRoutes.js";
import { authenticate } from "../middlewares/authenticate.js";
import { bonificacoesPapeisRoutes } from "./bonificacoesPapeisRoutes.js";
import { relatoriosRoutes } from "./relatoriosRoutes.js";
import { importacoesRoutes } from "./importacoesRoutes.js";

export const routes = Router();

// [ROTA] Pública: confere se a API está no ar.
routes.get("/health", (request, response) => {
  response.json({
    status: "ok",
    service: "sistema-indicadores-api",
  });
});

// [ROTA] Pública: login, esqueci a senha e redefinição (http/routes/authRoutes.js).
routes.use("/auth", authRoutes);
// [SEGURANCA] Daqui para baixo toda rota exige token válido (http/middlewares/authenticate.js).
routes.use(authenticate);
routes.use("/dashboard", dashboardRoutes);
routes.use("/bonificacoes-papeis", bonificacoesPapeisRoutes);
// [ROTA] Listas fixas dos formulários (cargos, papéis no projeto, níveis, departamentos).
routes.get("/opcoes-cadastro", (request, response) => {
  // `funcoes` é apenas um alias de compatibilidade para clientes antigos da API.
  response.json({
    cargos: cargosTi,
    niveisRemuneracao,
    papeisProjeto,
    departamentos: departamentosTi,
    funcoes: cargosTi,
  });
});
// [ROTA] Cadastros e operação; cada arquivo *Routes.js liga o caminho ao método do controller.
routes.use("/clientes", clientesRoutes);
routes.use("/colaboradores", colaboradoresRoutes);
routes.use("/remuneracoes", remuneracoesRoutes);
routes.use("/projetos", projetosRoutes);
routes.use("/apontamentos", apontamentosRoutes);

routes.use("/tarefas", tarefasRoutes);
routes.use("/sprints", sprintsRoutes);

routes.use("/premiacoes", premiacaoRoutes);
routes.use("/relatorios", relatoriosRoutes);
routes.use("/importacoes", importacoesRoutes);
