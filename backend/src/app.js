import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./http/middlewares/errorHandler.js";
import { routes } from "./http/routes/index.js";

export const app = express();

// O front lê o nome do arquivo baixado (planilhas) pelo Content-Disposition.
app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());

app.get("/", (request, response) => {
  response.json({
    message: "API do Sistema de Indicadores",
    health: "/api/health",
    resources: [
      "/api/clientes",
      "/api/colaboradores",
      "/api/colaboradores/:id/configuracoes-financeiras",
      "/api/remuneracoes",
      "/api/projetos",
      "/api/projetos/papeis",
      "/api/projetos/:id/equipe",
    ],
  });
});

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);
