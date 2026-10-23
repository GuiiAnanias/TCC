// Acrescenta somente os exemplos do passo 6 a uma base demo já existente.
import "dotenv/config";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { seedAwards } from "../prisma/seed-awards.js";
import { dashboardService } from "../src/services/dashboardService.js";
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || (url.searchParams.get("schema") || "public") !== "public") throw new Error("Este complemento aceita somente a base local de desenvolvimento, schema public.");
try {
  const before = await dashboardService.get({});
  const user = await prisma.usuario.findUnique({ where: { email: "admin@sistema.local" } });
  const ana = await prisma.colaborador.findUnique({ where: { email: "ana.demo@exemplo.local" } });
  const bruno = await prisma.colaborador.findUnique({ where: { email: "bruno.demo@exemplo.local" } });
  const portal = await prisma.projeto.findFirst({ where: { nome: "Portal do Cliente (demo)" } });
  const mobile = await prisma.projeto.findFirst({ where: { nome: "Aplicativo Mobile (demo)" } });
  if (![user, ana, bruno, portal, mobile].every(Boolean)) throw new Error("Cenários de demonstração não encontrados. Execute o seed completo apenas se desejar criá-los.");
  await prisma.$transaction((tx) => seedAwards(tx, { admin: user, people: { ana, bruno }, projects: { portal, mobile } }), { timeout: 30000 });
  const after = await dashboardService.get({});
  assert.deepEqual(after, before, "Complementar premiação não pode alterar o dashboard existente.");
  console.log(JSON.stringify({ mensagem: "Exemplos de premiação acrescentados sem modificar outros dados.", regras: await prisma.regraPremiacao.count(), avaliacoes: await prisma.avaliacaoPremiacao.count(), horas: after.resumo.horas, custo: after.resumo.custo, bonusPapel: after.resumo.bonificacao }));
} finally { await prisma.$disconnect(); }
