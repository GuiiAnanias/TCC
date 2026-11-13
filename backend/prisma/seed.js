/**
 * [BANCO] Seed: popula o banco com os dados de demonstração e a conta admin/admin123. Rodar na
 * pasta backend com `corepack pnpm run seed`. Rodar de novo não duplica nem redefine a senha da
 * conta.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "./seed-demo.js";

const prisma = new PrismaClient();
try {
  const summary = await seedDemo(prisma);
  console.log(
    "Seed de demonstração concluído (registros existentes e edições preservados):",
    summary,
  );
  console.log(
    "Cenários: abaixo/acima/no orçamento, pendências, planejamento, pausa, cancelamento e histórico encerrado.",
  );
  console.log(
    "Valores financeiros são fictícios. Indicadores operacionais e dashboards individuais disponíveis.",
  );
  console.log(
    "Premiação: regras sem faixas presumidas, rascunho Dev e exemplo PO/SM com percentuais fictícios informados.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
