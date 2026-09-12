import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("admin123", 10);

  await prisma.usuario.upsert({
    where: { email: "admin@sistema.local" },
    update: {},
    create: {
      nomeUsuario: "admin",
      email: "admin@sistema.local",
      senhaHash
    }
  });

  await prisma.itemTabelaRemuneracao.upsert({
    where: { nivel: "Junior" },
    update: {},
    create: {
      nivel: "Junior",
      valorHora: 45,
      bonificacao: 0,
      tipoBonificacao: "NENHUMA"
    }
  });

  await prisma.cliente.upsert({
    where: { nome: "E/Code" },
    update: {},
    create: { nome: "E/Code" }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
