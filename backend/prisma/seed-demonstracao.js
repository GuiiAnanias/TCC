/**
 * [BANCO] Dados de demonstração: tabela de remuneração, bonificações, clientes, colaboradores,
 * projetos, equipes, sprints, tarefas e apontamentos com datas fixas. Os resultados esperados no
 * dashboard estão no README.
 */

import bcrypt from "bcrypt";
import { seedCompanies } from "./seed-empresas.js";
import { seedAwards } from "./seed-premiacao.js";

const date = (day) => new Date(`${day}T00:00:00Z`);

// Preços, percentuais, pessoas e projetos são fictícios; os dois clientes com
// CNPJ usam dados públicos reais documentados em seed-empresas.js.
// O seed acrescenta registros ausentes; não apaga dados nem restaura edições manuais.
export async function seedDemo(prisma) {
  const senhaHash = await bcrypt.hash("admin123", 10);
  return prisma.$transaction(
    async (tx) => {
      const admin = await tx.usuario.upsert({
        where: { email: "admin@sistema.local" },
        update: {},
        create: { nomeUsuario: "admin", email: "admin@sistema.local", senhaHash },
      });
      const rates = {};
      for (const [key, nivel, valorHora, status = "ATIVO"] of [
        ["trainee", "Trainee I", 25],
        ["design", "Júnior I", 30],
        ["junior", "Júnior II", 40],
        ["qa", "Júnior III", 45],
        ["pleno", "Pleno I", 50],
        ["reajuste", "Pleno II", 60],
        ["futura", "Pleno III", 75],
        ["senior", "Sênior I", 85],
        ["antiga", "Trainee II", 20, "INATIVO"],
      ])
        rates[key] = await tx.itemTabelaRemuneracao.upsert({
          where: { nivel },
          update: {},
          create: { nivel, valorHora, status },
        });

      const clients = {};
      for (const [key, data] of [
        ...seedCompanies.map(({ key, data }) => [key, data]),
        [
          "marina",
          {
            nome: "Marina Oliveira (demo)",
            tipoPessoa: "PF",
            cpf: "52998224725",
            email: "marina.demo@exemplo.local",
            telefone: "11999990003",
          },
        ],
        [
          "arquivo",
          {
            nome: "Cliente histórico (demo)",
            tipoPessoa: "PJ",
            email: "historico@exemplo.local",
            telefone: "11999990004",
            status: "INATIVO",
          },
        ],
      ]) {
        const existing = data.cnpj
          ? await tx.cliente.findUnique({ where: { cnpj: data.cnpj } })
          : await tx.cliente.findFirst({
              where: { email: data.email, tipoPessoa: data.tipoPessoa },
            });
        clients[key] = existing ?? (await tx.cliente.create({ data }));
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
        ["iris", "Íris Melo (demo)", "UI/UX Designer", "Design"],
      ])
        people[key] = await tx.colaborador.upsert({
          where: { email: `${key}.demo@exemplo.local` },
          update: {},
          create: { nomeCompleto, email: `${key}.demo@exemplo.local`, cargo, departamento, status },
        });

      const configurations = {
        ana: [
          ["pleno", "2026-09-01", "2026-09-30", 300],
          ["reajuste", "2026-10-01", null, 400],
        ],
        bruno: [["senior", "2026-09-01", null, 600]],
        carla: [
          ["qa", "2026-09-01", "2026-10-31", 200],
          ["futura", "2026-11-01", null, 300],
        ],
        diego: [["junior", "2026-09-01", null, 150]],
        eva: [["trainee", "2026-09-01", null, 0]],
        gustavo: [["junior", "2026-09-01", null, 100]],
        helena: [["senior", "2026-09-01", "2026-09-30", 200]],
        iris: [["design", "2026-09-01", null, 100]],
        // Felipe não tem configuração: cenário intencional de horas sem custo.
      };
      for (const [key, versions] of Object.entries(configurations)) {
        const colaboradorId = people[key].id;
        if (await tx.configuracaoFinanceira.count({ where: { colaboradorId } })) continue;
        let anteriorId = null;
        for (const [rate, start, end, beneficios] of versions) {
          const item = rates[rate];
          const version = await tx.configuracaoFinanceira.create({
            data: {
              colaboradorId,
              itemTabelaId: item.id,
              valorHoraAplicado: item.valorHora,
              nivelAplicado: item.nivel,
              beneficios,
              dataInicio: date(start),
              dataFim: end ? date(end) : null,
              anteriorId,
              criadoPorId: admin.id,
              encerradoPorId: end ? admin.id : null,
              motivo: anteriorId
                ? "Reajuste de demonstração"
                : "Configuração inicial de demonstração",
            },
          });
          anteriorId = version.id;
        }
      }

      for (const [papel, versions] of [
        [
          "Dev",
          [
            [5, "2026-09-01", "2026-10-01"],
            [10, "2026-10-01", null],
          ],
        ],
        [
          "QA",
          [
            [10, "2026-09-01", "2026-11-01"],
            [0, "2026-11-01", null],
          ],
        ],
        ["Tech Lead", [[15, "2026-09-01", null]]],
      ]) {
        // Regras são globais: não substituir regras já cadastradas pela empresa.
        if (await tx.bonificacaoPapel.count({ where: { papel } })) continue;
        for (const [percentual, start, end] of versions)
          await tx.bonificacaoPapel.create({
            data: { papel, percentual, dataInicio: date(start), dataFim: end ? date(end) : null },
          });
      }

      const projects = {};
      for (const [
        key,
        nome,
        client,
        tipoContrato,
        horasContratadas,
        valorProjeto,
        status = "ATIVO",
        start = "2026-09-01",
      ] of [
        ["portal", "Portal do Cliente (demo)", "horizonte", "FEE_MENSAL", 40, 2424],
        ["mobile", "Aplicativo Mobile (demo)", "acme", "ESCOPO_FECHADO", 20, 539.5, "PAUSADO"],
        ["integracao", "Integração de Dados (demo)", "marina", "SQUAD", 14, 560],
        ["auditoria", "Projeto com pendências (demo)", "acme", "FEE_MENSAL", 30, 1000],
        [
          "planejamento",
          "Projeto em planejamento (demo)",
          "horizonte",
          "POR_HORA",
          80,
          5000,
          "CANCELADO",
          "2026-11-01",
        ],
        ["historico", "Projeto encerrado (demo)", "arquivo", "SQUAD", 8, 680, "ENCERRADO"],
      ]) {
        const clienteId = clients[client].id;
        projects[key] =
          (await tx.projeto.findFirst({ where: { nome, clienteId } })) ??
          (await tx.projeto.create({
            data: {
              nome,
              clienteId,
              tipoContrato,
              horasContratadas,
              valorProjeto,
              status,
              dataInicio: date(start),
            },
          }));
      }

      for (const [project, person, papel, start = "2026-09-01", end = null] of [
        ["portal", "ana", "Dev"],
        ["portal", "carla", "QA"],
        ["portal", "bruno", "Tech Lead"],
        ["mobile", "bruno", "Tech Lead"],
        ["mobile", "carla", "QA"],
        ["integracao", "diego", "QA", "2026-09-01", "2026-09-30"],
        ["integracao", "diego", "Dev", "2026-10-01"],
        ["integracao", "iris", "UI/UX Designer"],
        ["auditoria", "eva", "Dev"],
        ["auditoria", "felipe", "QA"],
        ["planejamento", "ana", "Dev", "2026-11-01"],
        ["historico", "helena", "Analista de Sistemas", "2026-09-01", "2026-09-30"],
      ]) {
        const projetoId = projects[project].id,
          colaboradorId = people[person].id;
        const where = { projetoId, colaboradorId, papel, dataEntrada: date(start) };
        if (!(await tx.projetoColaborador.findFirst({ where })))
          await tx.projetoColaborador.create({
            data: { ...where, dataSaida: end ? date(end) : null },
          });
      }

      const sprints = {};
      for (const [key, project, nome, start, end, statusRegistro = "ATIVO"] of [
        ["portal-set", "portal", "Sprint Setembro (demo)", "2026-09-01", "2026-09-15"],
        ["portal-out", "portal", "Sprint Outubro (demo)", "2026-10-01", "2026-10-15"],
        ["mobile-out", "mobile", "Sprint Mobile (demo)", "2026-10-01", "2026-10-15"],
        ["dados-set", "integracao", "Sprint Integração (demo)", "2026-09-01", "2026-09-15"],
        ["auditoria-out", "auditoria", "Sprint Auditoria (demo)", "2026-10-01", "2026-10-15"],
        ["futura", "planejamento", "Sprint Planejada (demo)", "2026-11-01", "2026-11-15"],
        [
          "historica",
          "historico",
          "Sprint Encerrada (demo)",
          "2026-09-01",
          "2026-09-15",
          "INATIVO",
        ],
      ]) {
        const where = {
          projetoId_origem_externalId: {
            projetoId: projects[project].id,
            origem: "DEMO",
            externalId: key,
          },
        };
        sprints[key] = await tx.sprint.upsert({
          where,
          update: {},
          create: {
            projetoId: projects[project].id,
            origem: "DEMO",
            externalId: key,
            nome,
            dataInicio: date(start),
            dataFim: date(end),
            statusRegistro,
          },
        });
      }

      const tasks = {};
      // key, projeto, sprint, título, status, minutos estimados, correção, responsáveis,
      // início, conclusão, cadastro. Horas são cadastradas separadamente, por pessoa.
      for (const [
        key,
        project,
        sprint,
        titulo,
        status,
        minutosEstimados,
        correcao,
        owners,
        start,
        end,
        statusRegistro = "ATIVO",
      ] of [
        [
          "portal-login",
          "portal",
          "portal-set",
          "Tela de login",
          "CONCLUIDA",
          480,
          false,
          ["ana", "carla"],
          "2026-09-10",
          "2026-09-12",
        ],
        [
          "portal-bug",
          "portal",
          "portal-out",
          "Corrigir validação do formulário",
          "CONCLUIDA",
          120,
          true,
          ["ana", "carla"],
          "2026-10-05",
          "2026-10-06",
        ],
        [
          "portal-perfil",
          "portal",
          "portal-out",
          "Página de perfil",
          "EM_ANDAMENTO",
          360,
          false,
          ["ana"],
          "2026-10-05",
          null,
        ],
        [
          "portal-sem-horas",
          "portal",
          "portal-out",
          "Revisar acessibilidade",
          "CONCLUIDA",
          60,
          false,
          ["carla"],
          "2026-10-07",
          "2026-10-07",
        ],
        [
          "portal-sem-estimativa",
          "portal",
          null,
          "Documentar componentes",
          "PLANEJADA",
          null,
          false,
          ["ana"],
          null,
          null,
        ],
        [
          "mobile-api",
          "mobile",
          "mobile-out",
          "Integração com API",
          "CONCLUIDA",
          240,
          false,
          ["bruno", "carla"],
          "2026-10-02",
          "2026-10-03",
        ],
        [
          "mobile-correcao",
          "mobile",
          "mobile-out",
          "Corrigir autenticação mobile",
          "CONCLUIDA",
          120,
          true,
          ["bruno", "carla"],
          "2026-10-04",
          "2026-10-04",
        ],
        [
          "mobile-cancelada",
          "mobile",
          "mobile-out",
          "Login por rede social",
          "CANCELADA",
          180,
          false,
          [],
          null,
          null,
          "INATIVO",
        ],
        [
          "dados-auditoria",
          "integracao",
          "dados-set",
          "Auditar carga de dados",
          "CONCLUIDA",
          300,
          false,
          ["diego"],
          "2026-09-15",
          "2026-09-15",
        ],
        [
          "dados-carga",
          "integracao",
          null,
          "Implementar carga incremental",
          "CONCLUIDA",
          300,
          false,
          ["diego"],
          "2026-10-06",
          "2026-10-06",
        ],
        [
          "dados-design",
          "integracao",
          null,
          "Desenhar painel de importação",
          "CONCLUIDA",
          240,
          false,
          ["iris"],
          "2026-10-06",
          "2026-10-06",
        ],
        [
          "auditoria-sem-estimativa",
          "auditoria",
          "auditoria-out",
          "Ajustar comportamento sem estimativa",
          "EM_ANDAMENTO",
          null,
          true,
          ["eva"],
          "2026-10-08",
          null,
        ],
        [
          "auditoria-qa",
          "auditoria",
          "auditoria-out",
          "Validar cenário sem remuneração",
          "CONCLUIDA",
          300,
          false,
          ["felipe"],
          "2026-10-09",
          "2026-10-09",
        ],
        [
          "auditoria-sem-horas",
          "auditoria",
          "auditoria-out",
          "Concluir checklist sem registrar horas",
          "CONCLUIDA",
          null,
          false,
          [],
          "2026-10-10",
          "2026-10-10",
        ],
        [
          "futura-backlog",
          "planejamento",
          "futura",
          "Planejar entrega inicial",
          "PLANEJADA",
          480,
          false,
          ["ana"],
          null,
          null,
        ],
        [
          "futura-descoberta",
          "planejamento",
          null,
          "Detalhar requisitos",
          "PLANEJADA",
          null,
          false,
          [],
          null,
          null,
        ],
        [
          "historica-entrega",
          "historico",
          "historica",
          "Entrega final do projeto",
          "CONCLUIDA",
          240,
          false,
          ["helena"],
          "2026-09-03",
          "2026-09-03",
          "INATIVO",
        ],
      ]) {
        const projetoId = projects[project].id;
        tasks[key] = await tx.tarefa.upsert({
          where: { projetoId_origem_externalId: { projetoId, origem: "DEMO", externalId: key } },
          update: {},
          create: {
            projetoId,
            sprintId: sprint ? sprints[sprint].id : null,
            origem: "DEMO",
            externalId: key,
            titulo,
            descricao: "Cenário fictício para validação manual dos indicadores.",
            status,
            minutosEstimados,
            correcao,
            dataInicio: start ? date(start) : null,
            dataConclusao: end ? date(end) : null,
            statusRegistro,
            responsaveis: {
              create: owners.map((person) => ({ colaboradorId: people[person].id })),
            },
          },
        });
      }

      for (const [key, project, person, task, day, horas, status] of [
        ["portal-login-dev", "portal", "ana", "portal-login", "2026-09-10", 8, "FATURADO"],
        ["portal-login-qa", "portal", "carla", "portal-login", "2026-09-12", 6, "APROVADO"],
        ["portal-bug-dev", "portal", "ana", "portal-bug", "2026-10-05", 2, "APROVADO"],
        ["portal-bug-qa", "portal", "carla", "portal-bug", "2026-10-06", 2, "APROVADO"],
        ["portal-perfil-dev", "portal", "ana", "portal-perfil", "2026-10-05", 4, "PENDENTE"],
        ["mobile-api-dev", "mobile", "bruno", "mobile-api", "2026-10-02", 6, "FATURADO"],
        ["mobile-api-qa", "mobile", "carla", "mobile-api", "2026-10-03", 4, "APROVADO"],
        ["mobile-correcao-dev", "mobile", "bruno", "mobile-correcao", "2026-10-04", 2, "APROVADO"],
        ["mobile-correcao-qa", "mobile", "carla", "mobile-correcao", "2026-10-04", 2, "PENDENTE"],
        ["dados-qa", "integracao", "diego", "dados-auditoria", "2026-09-15", 5, "FATURADO"],
        ["dados-dev", "integracao", "diego", "dados-carga", "2026-10-06", 5, "APROVADO"],
        ["dados-design", "integracao", "iris", "dados-design", "2026-10-06", 4, "APROVADO"],
        [
          "pendencia-estimativa",
          "auditoria",
          "eva",
          "auditoria-sem-estimativa",
          "2026-10-08",
          8,
          "PENDENTE",
        ],
        [
          "pendencia-remuneracao",
          "auditoria",
          "felipe",
          "auditoria-qa",
          "2026-10-09",
          5,
          "APROVADO",
        ],
        ["pendencia-equipe", "auditoria", "gustavo", null, "2026-10-10", 2, "PENDENTE"],
        [
          "historica-entrega",
          "historico",
          "helena",
          "historica-entrega",
          "2026-09-03",
          4,
          "FATURADO",
        ],
      ]) {
        const descricao = `Demonstração: ${key}`;
        const projetoId = projects[project].id,
          colaboradorId = people[person].id;
        if (
          !(await tx.apontamentoHora.findFirst({ where: { projetoId, colaboradorId, descricao } }))
        )
          await tx.apontamentoHora.create({
            data: {
              projetoId,
              colaboradorId,
              tarefaId: task ? tasks[task].id : null,
              data: date(day),
              horas,
              status,
              descricao,
            },
          });
      }
      await seedAwards(tx, { admin, people, projects });
      return {
        clientes: Object.keys(clients).length,
        colaboradores: Object.keys(people).length,
        faixas: Object.keys(rates).length,
        projetos: Object.keys(projects).length,
        sprints: Object.keys(sprints).length,
        tarefas: Object.keys(tasks).length,
        apontamentos: 16,
        avaliacoes: 2,
      };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
