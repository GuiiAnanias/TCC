import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`API do Sistema de Indicadores rodando em http://localhost:${env.port}`);
});
