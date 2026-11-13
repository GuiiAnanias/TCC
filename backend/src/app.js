/**
 * [INICIO] Monta a aplicação Express: CORS, leitura de JSON, rotas em /api e, por último, os
 * tratadores de erro.
 * Caminho de uma requisição: rota (http/routes) -> controller (http/controllers) -> schema Zod
 * (schemas) -> service (services) -> repository (repositories) -> Prisma -> PostgreSQL.
 */

import cors from "cors";
import express from "express";
import { tratarErros, rotaNaoEncontrada } from "./http/middlewares/tratamentoErros.js";
import { routes } from "./http/routes/index.js";

export const app = express();

// O front lê o nome do arquivo baixado (planilhas) pelo Content-Disposition.
// [SEGURANCA] CORS liberado para o front em outro endereço (porta 5173); expõe Content-Disposition
// para o navegador ler o nome dos arquivos baixados.
app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
// Lê o corpo JSON das requisições para request.body.
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

// [ROTA] Todas as rotas da API ficam abaixo de /api (ver http/routes/index.js).
app.use("/api", routes);

// [ERRO] Depois das rotas: endereço inexistente responde 404 e qualquer erro lançado cai no
// tratarErros.
app.use(rotaNaoEncontrada);
app.use(tratarErros);
