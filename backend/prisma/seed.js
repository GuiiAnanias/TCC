import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "./seed-demo.js";

const prisma = new PrismaClient();
try {
  const summary = await seedDemo(prisma);
  console.log("Seed de demonstração concluído (registros existentes e edições preservados):", summary);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
