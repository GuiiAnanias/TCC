/**
 * [INICIO] Ponto de entrada da API: sobe o servidor Express na porta do .env (PORT, padrão 3333).
 * Rodar com `corepack pnpm run dev`.
 */

import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`API do Sistema de Indicadores rodando em http://localhost:${env.port}`);
});
