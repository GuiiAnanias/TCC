import bcrypt from "bcrypt";
import { seedCompanies } from "./seed-companies.js";

const date = (day) => new Date(`${day}T00:00:00Z`);

// Preços, percentuais, pessoas e projetos são fictícios; os dois clientes com
// CNPJ usam dados públicos reais documentados em seed-companies.js.
// O seed acrescenta registros ausentes; não apaga dados nem restaura edições manuais.
export async function seedDemo(prisma) {
  const senhaHash = await bcrypt.hash("admin123", 10);
  return prisma.$transaction(async (tx) => {
    const admin = await tx.usuario.upsert({ where: { email: "admin@sistema.local" }, update: {}, create: { nomeUsuario: "admin", email: "admin@sistema.local", senhaHash } });
    const rates = {};
    for (const [key, nivel, valorHora, status = "ATIVO"] of [
      ["trainee", "Trainee I", 25], ["design", "Júnior I", 30], ["junior", "Júnior II", 40],
      ["qa", "Júnior III", 45], ["pleno", "Pleno I", 50], ["reajuste", "Pleno II", 60],
      ["futura", "Pleno III", 75], ["senior", "Sênior I", 85], ["antiga", "Trainee II", 20, "INATIVO"]
    ]) rates[key] = await tx.itemTabelaRemuneracao.upsert({ where: { nivel }, update: {}, create: { nivel, valorHora, status } });

    const clients = {};
    for (const [key, data] of [
      ...seedCompanies.map(({ key, data }) => [key, data]),
      ["marina", { nome: "Marina Oliveira (demo)", tipoPessoa: "PF", cpf: "52998224725", email: "marina.demo@exemplo.local", telefone: "11999990003" }],
      ["arquivo", { nome: "Cliente histórico (demo)", tipoPessoa: "PJ", email: "historico@exemplo.local", telefone: "11999990004", status: "INATIVO" }]
    ]) {
      const existing = data.cnpj
        ? await tx.cliente.findUnique({ where: { cnpj: data.cnpj } })
        : await tx.cliente.findFirst({ where: { email: data.email, tipoPessoa: data.tipoPessoa } });
      clients[key] = existing ?? await tx.cliente.create({ data });
    }

    const people = {};
    for (const [key, nomeCompleto, cargo, departamento, status = "ATIVO"] of [
      ["ana", "Ana Martins (demo)", "Desenvolvedor Front-end", "Desenvolvimento"],
      ["bruno", "Bruno Costa (demo)", "Tech Lead", "Tecnologia"],
      ["carla", "Carla Ribeiro (demo)", "QA", "Qualidade"],
      ["diego", "Diego Souza (demo)", "Desenvolvedor Back-end", "Desenvolvimento"],
      ["eva", "Eva Lima (demo)", "Programador", "Desenvolvimento"],
      ["felipe", "Felipe Alves (demo)", "QA", "Qualidade"],
      ["gustavo", "Gustavo Rocha (demo)", "Analista de Sistemas", "Tecnologia"],
      ["helena", "Helena Dias (demo)", "Analista de Sistemas", "Tecnologia", "INATIVO"],
      ["iris", "Íris Melo (demo)", "UI/UX Designer", "Design"]
    ]) people[key] = await tx.colaborador.upsert({ where: { email: `${key}.demo@exemplo.local` }, update: {}, create: { nomeCompleto, email: `${key}.demo@exemplo.local`, cargo, departamento, status } });

    const configurations = {
      ana: [["pleno", "2026-09-01", "2026-09-30", 300], ["reajuste", "2026-10-01", null, 400]],
      bruno: [["senior", "2026-09-01", null, 600]],
      carla: [["qa", "2026-09-01", "2026-10-31", 200], ["futura", "2026-11-01", null, 300]],
      diego: [["junior", "2026-09-01", null, 150]],
      eva: [["trainee", "2026-09-01", null, 0]],
      gustavo: [["junior", "2026-09-01", null, 100]],
      helena: [["senior", "2026-09-01", "2026-09-30", 200]],
      iris: [["design", "2026-09-01", null, 100]]
      // Felipe não tem configuração: cenário intencional de horas sem custo.
    };
    for (const [key, versions] of Object.entries(configurations)) {
      const colaboradorId = people[key].id;
      if (await tx.configuracaoFinanceira.count({ where: { colaboradorId } })) continue;
      let anteriorId = null;
      for (const [rate, start, end, beneficios] of versions) {
        const item = rates[rate];
        const version = await tx.configuracaoFinanceira.create({ data: {
          colaboradorId, itemTabelaId: item.id, valorHoraAplicado: item.valorHora, nivelAplicado: item.nivel,
          beneficios, dataInicio: date(start), dataFim: end ? date(end) : null,
          anteriorId, criadoPorId: admin.id, encerradoPorId: end ? admin.id : null,
          motivo: anteriorId ? "Reajuste de demonstração" : "Configuração inicial de demonstração"
        } });
        anteriorId = version.id;
      }
    }

    for (const [papel, versions] of [
      ["Dev", [[5, "2026-09-01", "2026-10-01"], [10, "2026-10-01", null]]],
      ["QA", [[10, "2026-09-01", "2026-11-01"], [0, "2026-11-01", null]]],
      ["Tech Lead", [[15, "2026-09-01", null]]]
    ]) {
      // Regras são globais: não substituir regras já cadastradas pela empresa.
      if (await tx.bonificacaoPapel.count({ where: { papel } })) continue;
      for (const [percentual, start, end] of versions) await tx.bonificacaoPapel.create({ data: { papel, percentual, dataInicio: date(start), dataFim: end ? date(end) : null } });
    }

    const projects = {};
    for (const [key, nome, client, tipoContrato, horasContratadas, valorProjeto, status = "ATIVO", start = "2026-09-01"] of [
      ["portal", "Portal do Cliente (demo)", "horizonte", "HORAS", 40, 2424],
      ["mobile", "Aplicativo Mobile (demo)", "acme", "FECHADO", 20, 539.50],
      ["integracao", "Integração de Dados (demo)", "marina", "FIXO", 14, 560],
      ["auditoria", "Projeto com pendências (demo)", "acme", "HORAS", 30, 1000],
      ["planejamento", "Projeto em planejamento (demo)", "horizonte", "FECHADO", 80, 5000, "ATIVO", "2026-11-01"],
      ["historico", "Projeto encerrado (demo)", "arquivo", "FIXO", 8, 680, "INATIVO"]
    ]) {
      const clienteId = clients[client].id;
      projects[key] = await tx.projeto.findFirst({ where: { nome, clienteId } }) ?? await tx.projeto.create({ data: { nome, clienteId, tipoContrato, horasContratadas, valorProjeto, status, dataInicio: date(start) } });
    }

    for (const [project, person, papel, start = "2026-09-01", end = null] of [
      ["portal", "ana", "Dev"], ["portal", "carla", "QA"], ["portal", "bruno", "Tech Lead"],
      ["mobile", "bruno", "Tech Lead"], ["mobile", "carla", "QA"],
      ["integracao", "diego", "QA", "2026-09-01", "2026-09-30"], ["integracao", "diego", "Dev", "2026-10-01"], ["integracao", "iris", "UI/UX Designer"],
      ["auditoria", "eva", "Dev"], ["auditoria", "felipe", "QA"],
      ["planejamento", "ana", "Dev", "2026-11-01"],
      ["historico", "helena", "Analista de Sistemas", "2026-09-01", "2026-09-30"]
    ]) {
      const projetoId = projects[project].id, colaboradorId = people[person].id;
      const where = { projetoId, colaboradorId, papel, dataEntrada: date(start) };
      if (!await tx.projetoColaborador.findFirst({ where })) await tx.projetoColaborador.create({ data: { ...where, dataSaida: end ? date(end) : null } });
    }

    return { clientes: Object.keys(clients).length, colaboradores: Object.keys(people).length, faixas: Object.keys(rates).length, projetos: Object.keys(projects).length };
  }, { timeout: 30000, maxWait: 10000 });
}
