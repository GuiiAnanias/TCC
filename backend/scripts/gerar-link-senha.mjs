// Gera um link de redefinição de senha de uso único, válido por 30 minutos.
// Uso, na pasta backend: corepack pnpm run senha:link admin
import prisma from "../src/config/prisma.js";
import { env } from "../src/config/env.js";
import { senhaService, VALIDADE_LINK_MINUTOS } from "../src/services/senhaService.js";

const login = process.argv.slice(2).find((arg) => arg !== "--");
if (!login) {
  console.error("Informe o usuário ou o e-mail. Exemplo: corepack pnpm run senha:link admin");
  process.exit(1);
}

try {
  const { usuario, expiraEm, link } = await senhaService.gerarLink(login, {
    frontendUrl: env.frontendUrl,
  });
  const ate = expiraEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  console.log(
    `Link de redefinição para "${usuario}" (uso único, vale ${VALIDADE_LINK_MINUTOS} min, até ${ate}):`,
  );
  console.log(link);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
