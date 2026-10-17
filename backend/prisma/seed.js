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

  const junior = await prisma.itemTabelaRemuneracao.upsert({
    where: { nivel: "Desenvolvedor Front-end" },
    update: {},
    create: {
      nivel: "Desenvolvedor Front-end",
      valorHora: 45,
      bonificacao: 0,
      tipoBonificacao: "NENHUMA"
    }
  });

  const pleno = await prisma.itemTabelaRemuneracao.upsert({
    where: { nivel: "Analista de Sistemas" },
    update: {},
    create: {
      nivel: "Analista de Sistemas",
      valorHora: 85,
      bonificacao: 8,
      tipoBonificacao: "PERCENTUAL"
    }
  });

  // Pessoas físicas podem ter nomes iguais; os exemplos são identificados por nome e tipo.
  async function ensureCompany(nome) {
    return await prisma.cliente.findFirst({ where: { nome, tipoPessoa: "PJ" } })
      || prisma.cliente.create({ data: { nome, tipoPessoa: "PJ" } });
  }
  const ecode = await ensureCompany("E/Code");
  const acme = await ensureCompany("Acme Tecnologia");

  const ana = await prisma.colaborador.upsert({
    where: { email: "ana.silva@exemplo.local" },
    update: {},
    create: {
      nomeCompleto: "Ana Silva",
      email: "ana.silva@exemplo.local",
      cargo: "Desenvolvedor Front-end",
      departamento: "Tecnologia"
    }
  });

  const bruno = await prisma.colaborador.upsert({
    where: { email: "bruno.costa@exemplo.local" },
    update: {},
    create: {
      nomeCompleto: "Bruno Costa",
      email: "bruno.costa@exemplo.local",
      cargo: "Analista de Sistemas",
      departamento: "Tecnologia"
    }
  });

  // Alinha somente os exemplos gerados pela versão anterior do seed.
  if (ana.cargo === "Desenvolvedora Front-end") {
    await prisma.colaborador.update({
      where: { id: ana.id },
      data: { cargo: "Desenvolvedor Front-end" }
    });
  }

  for (const [legacyName, target, collaboratorId, legacyValue, legacyBonus, legacyType] of [
    ["Junior", junior, bruno.id, "45", "0", "NENHUMA"],
    ["Pleno", pleno, ana.id, "85", "8", "PERCENTUAL"]
  ]) {
    const legacy = await prisma.itemTabelaRemuneracao.findUnique({ where: { nivel: legacyName } });
    if (!legacy || Number(legacy.valorHora) !== Number(legacyValue) ||
        Number(legacy.bonificacao) !== Number(legacyBonus) ||
        legacy.tipoBonificacao !== legacyType) continue;

    // Outras configurações podem depender da faixa antiga; nesse caso não a alteramos.
    const otherUses = await prisma.configuracaoFinanceira.count({
      where: { itemTabelaId: legacy.id, colaboradorId: { not: collaboratorId } }
    });
    if (otherUses) continue;

    await prisma.configuracaoFinanceira.updateMany({
      where: { colaboradorId: collaboratorId, itemTabelaId: legacy.id, dataFim: null },
      data: { itemTabelaId: target.id }
    });
    if (legacy.status === "ATIVO") {
      await prisma.itemTabelaRemuneracao.update({
        where: { id: legacy.id },
        data: { status: "INATIVO" }
      });
    }
  }

  const projects = [
    {
      nome: "Portal do Cliente (demo)",
      clienteId: ecode.id,
      tipoContrato: "HORAS",
      horasContratadas: 160,
      valorProjeto: 12000,
      dataInicio: new Date("2026-09-01")
    },
    {
      nome: "Painel de Indicadores (demo)",
      clienteId: acme.id,
      tipoContrato: "FECHADO",
      horasContratadas: 240,
      valorProjeto: 25000,
      dataInicio: new Date("2026-09-08")
    }
  ];

  const [portal, painel] = await Promise.all(projects.map(async (data) => {
    const existing = await prisma.projeto.findFirst({
      where: { nome: data.nome, clienteId: data.clienteId }
    });
    return existing ?? prisma.projeto.create({ data });
  }));

  const configurations = [
    { colaboradorId: ana.id, itemTabelaId: pleno.id, beneficios: 600, dataInicio: new Date("2026-09-01") },
    { colaboradorId: bruno.id, itemTabelaId: junior.id, beneficios: 400, dataInicio: new Date("2026-09-01") }
  ];

  for (const data of configurations) {
    const existing = await prisma.configuracaoFinanceira.findFirst({
      where: { colaboradorId: data.colaboradorId }
    });
    if (!existing) await prisma.configuracaoFinanceira.create({ data });
  }

  const team = [
    { projetoId: portal.id, colaboradorId: ana.id, papel: "Desenvolvedor Front-end", dataEntrada: new Date("2026-09-01") },
    { projetoId: painel.id, colaboradorId: bruno.id, papel: "Analista de Sistemas", dataEntrada: new Date("2026-09-08") }
  ];

  for (const data of team) {
    const existing = await prisma.projetoColaborador.findFirst({
      where: { projetoId: data.projetoId, colaboradorId: data.colaboradorId }
    });
    if (!existing) await prisma.projetoColaborador.create({ data });
  }

  const timeEntries = [
    { colaboradorId: ana.id, projetoId: portal.id, data: new Date("2026-09-10"), horas: 6, status: "APROVADO", descricao: "Implementação da página inicial (demo)" },
    { colaboradorId: bruno.id, projetoId: painel.id, data: new Date("2026-09-11"), horas: 4, status: "PENDENTE", descricao: "Levantamento dos indicadores (demo)" }
  ];

  for (const data of timeEntries) {
    const existing = await prisma.apontamentoHora.findFirst({
      where: { colaboradorId: data.colaboradorId, projetoId: data.projetoId, descricao: data.descricao }
    });
    if (!existing) await prisma.apontamentoHora.create({ data });
  }

  console.log("Seed concluído: 2 clientes, 2 colaboradores, 2 faixas, 2 projetos e 2 apontamentos de demonstração.");
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
