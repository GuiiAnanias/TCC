/**
 * [BANCO] Seed principal (pnpm run seed): dados plausíveis de uma empresa de software,
 * com volume suficiente para que todas as tabelas do sistema tenham mais de uma página (20 por
 * página; 10 no histórico de importações). Período: janeiro de 2025 até novembro de 2026.
 *
 * Uso (na pasta backend, com o Docker ligado e as migrations aplicadas):
 *   pnpm run seed                  banco vazio (instalação nova)
 *   pnpm run seed --apagar-tudo    recria os dados num banco que já tem registros
 *
 * Só aceita PostgreSQL local. Com dados no schema configurado, recusa a execução sem
 * --apagar-tudo; com essa opção, recria os dados desse schema. Logins fictícios:
 * admin / Admin123@ e admin2 / Admin123@.
 * O seed menor de demonstração, usado nos testes, continua em pnpm run seed:demo.
 */

import "dotenv/config";
import bcrypt from "bcrypt";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://x@invalido/x");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
  console.error("Recusado: este seed só roda em PostgreSQL local.");
  process.exit(1);
}

const { default: prisma } = await import("../src/config/prisma.js");
const { premiacaoTemplates, categoriaDoPapel } = await import("../src/services/regrasPremiacao.js");
const { buildAwardContent } = await import("../src/repositories/premiacaoRepository.js");
const { relatoriosGeradosService } = await import("../src/services/relatoriosGeradosService.js");
const { relatorioCreateSchema } = await import("../src/schemas/relatoriosSchemas.js");

// ---------------------------------------------------------------- aleatório reproduzível
let semente = 20261122;
function rnd() {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (lista) => lista[Math.floor(rnd() * lista.length)];
const chance = (p) => rnd() < p;
function sample(lista, k) {
  const copia = [...lista];
  const saida = [];
  while (saida.length < k && copia.length)
    saida.push(copia.splice(Math.floor(rnd() * copia.length), 1)[0]);
  return saida;
}

// ---------------------------------------------------------------- datas (dias UTC)
const DIA = 86400000;
const dia = (texto) => Math.floor(Date.parse(`${texto}T00:00:00Z`) / DIA);
const data = (d) => new Date(d * DIA);
const iso = (d) => data(d).toISOString().slice(0, 10);
const fimDeSemana = (d) => [0, 6].includes(new Date(d * DIA).getUTCDay());
const competencia = (d) => iso(d).slice(0, 7);
const INICIO = dia("2025-01-06");
const ULTIMO = dia("2026-11-20"); // último dia útil com horas
const HOJE = dia("2026-11-22");

// ---------------------------------------------------------------- documentos válidos
function cnpj(base12) {
  const calc = (n, pesos) => {
    const s = n.reduce((a, x, i) => a + x * pesos[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const n = base12.split("").map(Number);
  const d1 = calc(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base12 + d1 + calc([...n, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}
function cpf(base9) {
  const calc = (n) => {
    const s = n.reduce((a, x, i) => a + x * (n.length + 1 - i), 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const n = base9.split("").map(Number);
  const d1 = calc(n);
  return base9 + d1 + calc([...n, d1]);
}

// ---------------------------------------------------------------- catálogos
const niveis = ["Trainee", "Júnior", "Pleno", "Sênior"].flatMap((n) =>
  ["I", "II", "III", "IV", "V"].map((f) => `${n} ${f}`),
);
const valorNivel = (i) => Math.round((24 + i * 6.8 + (i % 5) * 0.9) * 100) / 100;
const papelDoCargo = (cargo) =>
  ({
    "Desenvolvedor Full Stack": "Dev",
    "Desenvolvedor Back-end": "Dev",
    "Desenvolvedor Front-end": "Dev",
    "Desenvolvedor Mobile": "Dev",
    Programador: "Dev",
  })[cargo] ?? cargo;

// nome, cargo, departamento, admissão, nível inicial (0 a 19), saída (opcional)
const PESSOAS = [
  ["Tiago Araújo", "Arquiteto de Software", "Tecnologia", "2021-03-01", 15],
  ["Márcio Teixeira Lopes", "Tech Lead", "Desenvolvimento", "2015-03-02", 0],
  ["Ana Martins", "Desenvolvedor Front-end", "Desenvolvimento", "2023-02-01", 8],
  ["Bruno Costa", "Tech Lead", "Tecnologia", "2020-06-01", 15],
  ["Carla Ribeiro", "QA", "Qualidade", "2023-08-01", 6],
  ["Diego Souza", "Desenvolvedor Back-end", "Desenvolvimento", "2022-04-04", 10],
  ["Eva Lima", "Programador", "Desenvolvimento", "2024-09-02", 3],
  ["Gustavo Rocha", "Analista de Sistemas", "Tecnologia", "2022-01-10", 9],
  ["Helena Dias", "Analista de Sistemas", "Tecnologia", "2021-05-03", 12, "2026-06-30"],
  ["Íris Melo", "UI/UX Designer", "Design", "2023-03-06", 6],
  ["João Pereira", "Desenvolvedor Full Stack", "Desenvolvimento", "2021-09-01", 13],
  ["Karina Gomes", "Product Owner", "Produto", "2020-11-03", 14],
  ["Lucas Ferreira", "Desenvolvedor Mobile", "Desenvolvimento", "2022-07-01", 11],
  ["Mariana Santos", "Scrum Master", "Produto", "2022-02-01", 11],
  ["Nicolas Almeida", "DevOps", "Infraestrutura", "2021-08-02", 13],
  ["Olívia Carvalho", "Desenvolvedor Back-end", "Desenvolvimento", "2024-02-05", 5],
  ["Pedro Barbosa", "Engenheiro de Dados", "Dados", "2022-10-03", 10],
  ["Rafael Mendes", "Desenvolvedor Front-end", "Desenvolvimento", "2025-08-04", 1],
  ["Sofia Teixeira", "QA", "Qualidade", "2022-05-02", 8],
  ["Valentina Moreira", "UI/UX Designer", "Design", "2022-08-01", 9],
  ["Wagner Cardoso", "Suporte Técnico", "Suporte", "2023-01-09", 4],
  ["Yasmin Ramos", "Desenvolvedor Full Stack", "Desenvolvimento", "2022-03-07", 10],
  ["Beatriz Nascimento", "Desenvolvedor Back-end", "Desenvolvimento", "2021-11-01", 12],
  ["Caio Freitas", "Desenvolvedor Front-end", "Desenvolvimento", "2023-05-02", 7],
  ["Daniela Moura", "QA", "Qualidade", "2024-03-04", 4],
  ["Enzo Batista", "Programador", "Desenvolvimento", "2025-02-03", 2],
  ["Fernanda Castro", "Product Owner", "Produto", "2021-07-01", 13],
  ["Guilherme Pires", "DBA", "Dados", "2020-09-01", 14],
  ["Heitor Campos", "Especialista em Segurança", "Segurança da Informação", "2021-02-01", 14],
  ["Isabela Duarte", "Analista de Negócios", "Produto", "2022-09-05", 9],
  ["Juliana Rezende", "Desenvolvedor Mobile", "Desenvolvimento", "2023-10-02", 6],
  ["Leonardo Vieira", "DevOps", "Infraestrutura", "2023-06-05", 8],
  ["Manuela Correia", "Analista de Produto", "Produto", "2024-01-08", 6],
  ["Natália Fontes", "Scrum Master", "Produto", "2023-04-03", 8],
  ["Otávio Brandão", "Desenvolvedor Full Stack", "Desenvolvimento", "2020-04-01", 16],
  ["Paula Siqueira", "Suporte Técnico", "Suporte", "2024-06-03", 2, "2026-03-31"],
  ["Renan Queiroz", "Engenheiro de Dados", "Dados", "2023-11-06", 7],
  ["Sabrina Torres", "Desenvolvedor Back-end", "Desenvolvimento", "2024-08-05", 4],
  ["Thiago Monteiro", "Gerente de Projeto", "Tecnologia", "2019-10-01", 17],
  ["Vinícius Lacerda", "Desenvolvedor Front-end", "Desenvolvimento", "2024-11-04", 3],
  ["Larissa Peixoto", "QA", "Qualidade", "2025-03-10", 3],
  ["Murilo Assis", "Desenvolvedor Back-end", "Desenvolvimento", "2025-06-02", 4],
  ["Letícia Furtado", "Analista de Sistemas", "Tecnologia", "2025-01-13", 6],
  ["Felipe Alves", "QA", "Qualidade", "2026-11-03", 3], // recém-contratado, ainda sem valor/hora
  ["Otto Guimarães", "Suporte Técnico", "Suporte", "2023-02-06", 4, "2025-10-31"],
];

// razão social, fantasia, cidade, UF
const EMPRESAS = [
  ["Horizonte Logística Ltda", "Horizonte Log", "Campinas", "SP"],
  ["Vale Verde Alimentos S.A.", "Vale Verde", "Ribeirão Preto", "SP"],
  ["Atlântico Seguros S.A.", "Atlântico", "Rio de Janeiro", "RJ"],
  ["Serra Azul Construtora Ltda", "Serra Azul", "Belo Horizonte", "MG"],
  ["Prime Saúde Clínicas Ltda", "Prime Saúde", "Curitiba", "PR"],
  ["Estrela Educação Ltda", "Colégio Estrela", "Florianópolis", "SC"],
  ["Delta Transportes Ltda", "Delta", "Porto Alegre", "RS"],
  ["Nova Era Varejo Ltda", "Nova Era", "São Paulo", "SP"],
  ["Sul Energia Renovável S.A.", "Sul Energia", "Joinville", "SC"],
  ["Ponto Certo Farmácias Ltda", "Ponto Certo", "Goiânia", "GO"],
  ["Rede Norte Telecom Ltda", "Rede Norte", "Manaus", "AM"],
  ["Ômega Consultoria Contábil Ltda", "Ômega Contábil", "São Paulo", "SP"],
  ["Sigma Indústria Têxtil Ltda", "Sigma Têxtil", "Blumenau", "SC"],
  ["Brasil Agro Cooperativa", "Brasil Agro", "Londrina", "PR"],
  ["Global Turismo Ltda", "Global Viagens", "Salvador", "BA"],
  ["Alfa Imobiliária Ltda", "Alfa Imóveis", "Recife", "PE"],
  ["Mega Pet Comércio Ltda", "Mega Pet", "São José do Rio Preto", "SP"],
  ["Lumen Engenharia Elétrica Ltda", "Lumen", "Uberlândia", "MG"],
  ["Aurora Cosméticos Ltda", "Aurora", "Vitória", "ES"],
  ["Pinheiro Advogados Associados", "Pinheiro Advogados", "Curitiba", "PR"],
  ["Maré Alta Pescados Ltda", "Maré Alta", "Itajaí", "SC"],
  ["Cia Paulista de Embalagens", "Paulista Embalagens", "Sorocaba", "SP"],
  ["Ventura Locadora de Veículos Ltda", "Ventura", "Fortaleza", "CE"],
  ["Ipê Hospital Veterinário Ltda", "Ipê Vet", "Campo Grande", "MS"],
  ["Beta Engenharia Ltda", "Beta Eng", "Brasília", "DF", "INATIVO"],
  ["Norte Distribuidora Ltda", "Norte Distribuição", "Belém", "PA", "INATIVO"],
];
const PESSOAS_FISICAS = [
  ["Marina Oliveira", "São Paulo"],
  ["Roberto Nunes", "Santos"],
  ["Camila Freitas", "Niterói"],
  ["Sérgio Antunes", "Londrina"],
];

// Projetos: nome, cliente (índice em EMPRESAS ou "pf:n"), contrato, status, início, fim,
// equipe (tamanho), consumo do orçamento (horas lançadas ÷ contratadas).
const PROJETOS = [
  ["Sustentação do ERP Horizonte", 0, "FEE_MENSAL", "ATIVO", "2025-01-06", null, 22, 0.92],
  ["Aplicativo de Pedidos", 1, "ESCOPO_FECHADO", "ATIVO", "2026-02-02", null, 5, 0.8],
  ["Painel de Sinistros", 2, "POR_HORA", "ATIVO", "2026-03-02", null, 4, 1.0],
  ["Controle de Obras", 3, "SQUAD", "ATIVO", "2025-09-01", null, 6, 0.95],
  ["Agenda Online de Consultas", 4, "ESCOPO_FECHADO", "ATIVO", "2026-05-04", null, 4, 1.12],
  ["Plataforma de Ensino a Distância", 5, "ESCOPO_FECHADO", "ATIVO", "2026-01-12", null, 5, 0.85],
  ["Rastreamento de Frota", 6, "SQUAD", "ATIVO", "2026-04-06", null, 5, 0.7],
  ["Loja Virtual", 7, "ESCOPO_FECHADO", "ATIVO", "2026-06-01", null, 5, 0.75],
  ["Monitoramento de Usinas", 8, "POR_HORA", "ATIVO", "2026-03-16", null, 4, 1.0],
  ["Receita Digital", 9, "ESCOPO_FECHADO", "ATIVO", "2026-07-06", null, 4, 0.6],
  ["Central de Chamados", 10, "FEE_MENSAL", "ATIVO", "2025-11-03", null, 4, 0.98],
  ["Integração Fiscal", 11, "ESCOPO_FECHADO", "ATIVO", "2026-08-03", null, 3, 1.18],
  ["Gestão de Estoque", 12, "ESCOPO_FECHADO", "ATIVO", "2026-02-16", null, 5, 0.9],
  ["Previsão de Safra", 13, "POR_HORA", "ATIVO", "2026-04-13", null, 3, 1.0],
  ["Sistema de Reservas", 14, "ESCOPO_FECHADO", "ATIVO", "2026-05-18", null, 5, 0.82],
  ["Portal de Imóveis", 15, "ESCOPO_FECHADO", "ATIVO", "2026-06-15", null, 3, 0.88],
  ["Programa de Fidelidade", 16, "FEE_MENSAL", "ATIVO", "2026-03-02", null, 4, 0.97],
  ["Medição de Consumo de Energia", 17, "ESCOPO_FECHADO", "ATIVO", "2026-07-20", null, 4, 0.65],
  ["Catálogo de Produtos", 18, "ESCOPO_FECHADO", "ATIVO", "2026-08-17", null, 3, 0.7],
  ["Gestão de Processos Jurídicos", 19, "SQUAD", "ATIVO", "2026-01-19", null, 4, 1.05],
  ["Rastreabilidade de Pescados", 20, "ESCOPO_FECHADO", "ATIVO", "2026-09-01", null, 3, 0.5],
  ["Automação da Linha de Embalagem", 21, "POR_HORA", "ATIVO", "2026-04-20", null, 4, 1.0],
  ["Site Institucional", "pf:0", "ESCOPO_FECHADO", "ATIVO", "2026-10-05", null, 2, 0.55],
  ["Reservas de Veículos", 22, "ESCOPO_FECHADO", "PAUSADO", "2026-02-02", "2026-07-31", 3, 0.6],
  ["Prontuário Veterinário", 23, "SQUAD", "PAUSADO", "2026-03-09", "2026-09-30", 4, 0.7],
  ["Medição de Obras", 24, "ESCOPO_FECHADO", "ENCERRADO", "2025-03-03", "2025-11-28", 4, 1.0],
  ["Roteirização de Entregas", 25, "POR_HORA", "ENCERRADO", "2025-05-05", "2026-02-27", 4, 1.0],
  ["Migração para Nuvem", 0, "SQUAD", "ENCERRADO", "2025-02-03", "2025-12-19", 5, 1.08],
  ["Automação de Planilhas", "pf:1", "POR_HORA", "CANCELADO", "2026-02-09", "2026-04-17", 2, 0.4],
  [
    "Aplicativo de Treinos",
    "pf:3",
    "ESCOPO_FECHADO",
    "CANCELADO",
    "2026-05-11",
    "2026-06-26",
    2,
    0.35,
  ],
];

const TITULOS = [
  "Tela de login com recuperação de senha",
  "Listagem com filtros e paginação",
  "Cadastro com validação de campos",
  "Integração com a API do cliente",
  "Relatório em PDF",
  "Exportação para Excel",
  "Ajuste de desempenho na consulta principal",
  "Correção de cálculo de totais",
  "Painel com indicadores do mês",
  "Notificações por e-mail",
  "Controle de permissões por perfil",
  "Importação de planilha",
  "Testes de regressão",
  "Revisão de acessibilidade",
  "Documentação da API",
  "Pipeline de deploy",
  "Correção de layout no celular",
  "Auditoria de logs de acesso",
  "Migração de dados legados",
  "Homologação com o cliente",
];
const ATIVIDADES = [
  "Implementação da funcionalidade e testes locais.",
  "Revisão de código e ajustes apontados.",
  "Reunião de alinhamento com o cliente.",
  "Correção de defeito encontrado na homologação.",
  "Testes de regressão do módulo.",
  "Refinamento do backlog e estimativas.",
  "Daily e planejamento da sprint.",
  "Investigação de lentidão e ajuste da consulta.",
  "Deploy em homologação e acompanhamento.",
  "Documentação técnica da entrega.",
];

// Evidência de cada critério quando há ocorrência (exemplos fictícios).
const EVIDENCIAS = {
  DEV: {
    estimativas: "Assertividade das estimativas em 68% no mês (dashboard do colaborador).",
    sem_horas: "Duas tarefas concluídas sem horas lançadas na sprint.",
    registro_tardio: "Horas lançadas três dias após o fim da sprint.",
    sem_estimativa: "Uma tarefa iniciada sem estimativa de tempo.",
    correcao_original:
      "Correção levou 30% do tempo da tarefa original; erro confirmado na revisão.",
    volume_correcao: "3 de 18 tarefas do mês foram correções (17%).",
    atrasos: "2 de 12 tarefas entregues depois do prazo combinado.",
    notificacoes: "Uma ausência sem aviso registrada pelo gestor.",
  },
  PO_SM: {
    impedimento_justificativa: "Impedimento da integração sem justificativa registrada.",
    impedimento_resposta: "Impedimento aberto por seis dias sem encaminhamento.",
    sprint_aberta: "Três tarefas continuaram abertas na sprint já finalizada.",
    sem_estimativa: "Duas histórias entraram no planejamento sem estimativa.",
    sem_horas: "Tarefas concluídas sem horas lançadas pelo time.",
    registro_tardio: "Horas lançadas após o fechamento da sprint.",
    sem_prazo: "Tarefas sem data de vencimento no backlog da sprint.",
    estimativas: "Assertividade das estimativas do time em 70%.",
    requisitos: "História entrou na sprint sem critério de aceite.",
    sem_sprint: "Tarefas executadas fora de uma sprint.",
  },
};

// ---------------------------------------------------------------- inserção
async function inserir(modelo, linhas, lote = 1000) {
  for (let i = 0; i < linhas.length; i += lote)
    await prisma[modelo].createMany({ data: linhas.slice(i, i + lote) });
}
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

async function main() {
  const [{ schema }] = await prisma.$queryRaw`SELECT current_schema() AS schema`;
  const tabelas = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (!tabelas.length) throw new Error("Aplique as migrações antes de executar o seed.");
  const identificador = (nome) => `"${nome.replaceAll('"', '""')}"`;
  const tabela = (nome) => `${identificador(schema)}.${identificador(nome)}`;
  // Verificar todas as tabelas também protege bases que só contêm catálogos ou históricos.
  // Não usar CASCADE: uma referência em outro schema deve impedir a limpeza.
  if (process.argv.includes("--apagar-tudo")) {
    log(`Recriando os dados do schema ${schema}…`);
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tabelas.map((t) => tabela(t.tablename)).join(", ")} RESTART IDENTITY`,
    );
  } else {
    for (const { tablename } of tabelas) {
      const [{ existe }] = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (SELECT 1 FROM ${tabela(tablename)}) AS existe`,
      );
      if (existe)
        throw new Error(
          `O schema "${schema}" já tem dados. Nada foi alterado. ` +
            "Para apagar e recriar esses dados, rode pnpm run seed --apagar-tudo.",
        );
    }
  }

  // ------------------------------------------------ usuários
  const senhaHash = await bcrypt.hash("Admin123@", 10);
  await inserir("usuario", [
    { id: 1, nomeUsuario: "admin", email: "admin@sistema.local", senhaHash },
    { id: 2, nomeUsuario: "admin2", email: "admin2@sistema.local", senhaHash },
  ]);
  const admin = { id: 1, nomeUsuario: "admin" };

  // ------------------------------------------------ tabela de remuneração (os 20 níveis)
  const faixas = niveis.map((nivel, i) => ({ id: i + 1, nivel, valorHora: valorNivel(i) }));
  await inserir("itemTabelaRemuneracao", faixas);

  // ------------------------------------------------ bonificação por papel (vigências contíguas)
  const bonus = [];
  for (const [papel, versoes] of [
    [
      "Dev",
      [
        [5, "2025-01-01"],
        [6, "2025-07-01"],
        [8, "2026-01-01"],
      ],
    ],
    [
      "QA",
      [
        [4, "2025-01-01"],
        [5, "2025-10-01"],
        [6, "2026-04-01"],
      ],
    ],
    [
      "Tech Lead",
      [
        [10, "2025-01-01"],
        [12, "2026-01-01"],
      ],
    ],
    [
      "Arquiteto de Software",
      [
        [10, "2025-01-01"],
        [12, "2026-01-01"],
      ],
    ],
    [
      "Product Owner",
      [
        [8, "2025-01-01"],
        [10, "2025-09-01"],
      ],
    ],
    [
      "Scrum Master",
      [
        [6, "2025-01-01"],
        [8, "2026-03-01"],
      ],
    ],
    [
      "UI/UX Designer",
      [
        [4, "2025-01-01"],
        [5, "2026-01-01"],
      ],
    ],
    [
      "DevOps",
      [
        [6, "2025-01-01"],
        [7, "2026-02-01"],
      ],
    ],
    [
      "Engenheiro de Dados",
      [
        [6, "2025-01-01"],
        [8, "2026-01-01"],
      ],
    ],
    [
      "Analista de Sistemas",
      [
        [5, "2025-01-01"],
        [6, "2026-01-01"],
      ],
    ],
    [
      "Suporte Técnico",
      [
        [3, "2025-01-01"],
        [4, "2026-01-01"],
      ],
    ],
    ["Gerente de Projeto", [[10, "2025-01-01"]]],
  ])
    versoes.forEach(([percentual, inicio], i) =>
      bonus.push({
        id: bonus.length + 1,
        papel,
        percentual,
        dataInicio: new Date(`${inicio}T00:00:00Z`),
        // Fim exclusivo: é o início da próxima vigência.
        dataFim: versoes[i + 1] ? new Date(`${versoes[i + 1][1]}T00:00:00Z`) : null,
      }),
    );
  await inserir("bonificacaoPapel", bonus);

  // ------------------------------------------------ clientes
  const clientes = EMPRESAS.map(([nome, nomeFantasia, cidade, estado, status = "ATIVO"], i) => ({
    id: i + 1,
    nome,
    nomeFantasia,
    tipoPessoa: "PJ",
    cnpj: cnpj(String(11222333 + i * 104729).slice(-8) + "0001"),
    email: `contato@${nomeFantasia
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z]/g, "")}.com.br`,
    telefone: `${int(11, 99)}3${String(3000000 + i * 7919).slice(-7)}`,
    contato: pick([
      "Marcos Lima",
      "Patrícia Souza",
      "Renato Alves",
      "Juliana Rocha",
      "Cláudio Reis",
    ]),
    cidade,
    estado,
    situacaoCadastral: "ATIVA",
    porte: i % 3 ? "EMPRESA DE PEQUENO PORTE" : "DEMAIS",
    atividadePrincipal: "Comércio e serviços",
    status,
    createdAt: data(dia("2024-12-16") + i),
  }));
  PESSOAS_FISICAS.forEach(([nome, cidade], i) =>
    clientes.push({
      id: clientes.length + 1,
      nome,
      tipoPessoa: "PF",
      cpf: cpf(String(123456780 + i * 111)),
      email: `${nome.split(" ")[0].toLowerCase()}@exemplo.com.br`,
      telefone: `1199${String(8000000 + i * 1234)}`,
      cidade,
      estado: "SP",
      createdAt: data(dia("2025-06-02") + i * 30),
    }),
  );
  await inserir("cliente", clientes);
  const clienteDe = (ref) =>
    typeof ref === "string" ? EMPRESAS.length + Number(ref.split(":")[1]) + 1 : ref + 1;

  // ------------------------------------------------ colaboradores
  const pessoas = PESSOAS.map(([nome, cargo, departamento, admissao, nivel, saida], i) => ({
    id: i + 1,
    nome,
    cargo,
    departamento,
    papel: papelDoCargo(cargo),
    admissao: dia(admissao),
    saida: saida ? dia(saida) : null,
    nivel,
  }));
  await inserir(
    "colaborador",
    pessoas.map((p) => ({
      id: p.id,
      nomeCompleto: p.nome,
      email: `${p.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(" ")
        .filter((_, i, a) => i === 0 || i === a.length - 1)
        .join(".")}@empresa.com.br`,
      cargo: p.cargo,
      departamento: p.departamento,
      status: p.saida ? "INATIVO" : "ATIVO",
      createdAt: data(Math.max(p.admissao, dia("2024-12-02"))),
    })),
  );
  const pessoaPorNome = new Map(pessoas.map((p) => [p.nome, p]));
  const TIAGO = pessoaPorNome.get("Tiago Araújo");
  const VETERANO = pessoaPorNome.get("Márcio Teixeira Lopes");
  const NOVATO = pessoaPorNome.get("Felipe Alves");

  // ------------------------------------------------ valor/hora (vigências contíguas)
  const configs = [];
  const cobertura = new Map(pessoas.map((p) => [p.id, []]));
  for (const p of pessoas) {
    if (p === NOVATO) continue; // cadastro do valor/hora ainda pendente
    // O veterano tem o histórico completo desde 2015 (promoções e reajustes semestrais).
    const trocas = [];
    if (p === VETERANO) {
      for (let k = 0, d = p.admissao; d < HOJE && k < 23; k++, d += int(150, 200)) trocas.push(d);
    } else {
      trocas.push(p.admissao);
      if (!p.saida && chance(0.55))
        trocas.push(dia(pick(["2025-07-01", "2026-01-01", "2026-07-01"])));
      if (!p.saida && chance(0.25)) trocas.push(dia("2026-10-01"));
    }
    // Reajustes só depois de 30 dias de casa.
    for (let k = trocas.length - 1; k > 0; k--)
      if (trocas[k] < p.admissao + 30) trocas.splice(k, 1);
    trocas.sort((a, b) => a - b);
    const unicas = trocas.filter((d, i) => i === 0 || d > trocas[i - 1] + 30);
    let anteriorId = null;
    let nivel = p.nivel;
    unicas.forEach((inicio, k) => {
      const ultima = k === unicas.length - 1;
      const fim = ultima ? p.saida : unicas[k + 1] - 1;
      const id = configs.length + 1;
      configs.push({
        id,
        colaboradorId: p.id,
        itemTabelaId: nivel + 1,
        valorHoraAplicado: faixas[nivel].valorHora,
        nivelAplicado: faixas[nivel].nivel,
        beneficios: pick([350, 450, 600, 800]),
        dataInicio: data(inicio),
        dataFim: fim === null ? null : data(fim),
        anteriorId,
        criadoPorId: 1,
        encerradoPorId: fim === null ? null : 1,
        motivo:
          k === 0
            ? "Configuração inicial"
            : pick(["Reajuste anual", "Promoção", "Promoção após avaliação de desempenho"]),
        createdAt: data(Math.max(inicio, dia("2024-12-02"))),
      });
      cobertura.get(p.id).push([inicio, fim ?? Infinity]);
      anteriorId = id;
      nivel = Math.min(nivel + (p === VETERANO ? 1 : int(1, 2)), niveis.length - 1);
    });
  }
  for (const c of configs) await prisma.configuracaoFinanceira.create({ data: c });
  const temValorHora = (pid, d) => cobertura.get(pid).some(([a, b]) => a <= d && d <= b);

  // ------------------------------------------------ projetos e equipes
  const projetos = PROJETOS.map(
    ([nome, cli, contrato, status, inicio, fim, tamanho, consumo], i) => ({
      id: i + 1,
      nome,
      clienteId: clienteDe(cli),
      tipoContrato: contrato,
      status,
      inicio: dia(inicio),
      fim: fim ? dia(fim) : null, // último dia com horas
      tamanho,
      consumo,
    }),
  );
  const ativa = (p, d) => d >= p.admissao && (p.saida === null || d <= p.saida);
  const equipe = [];
  const vinculos = new Map(pessoas.map((p) => [p.id, []])); // pessoa -> [{projeto, papel, ini, fim}]
  const vincular = (proj, p, papel, ini, fim) => {
    equipe.push({
      id: equipe.length + 1,
      projetoId: proj.id,
      colaboradorId: p.id,
      papel,
      dataEntrada: data(ini),
      dataSaida: fim === null ? null : data(fim),
    });
    vinculos.get(p.id).push({ projetoId: proj.id, papel, ini, fim: fim ?? Infinity });
  };
  const disponiveis = pessoas.filter((p) => p !== TIAGO && p !== NOVATO);
  for (const proj of projetos) {
    const termino = proj.fim ?? HOJE + 400;
    // O arquiteto acompanha todos os projetos ativos (e o longo desde o início).
    if (proj.status === "ATIVO") vincular(proj, TIAGO, "Arquiteto de Software", proj.inicio, null);
    const candidatos = disponiveis.filter(
      (p) => ativa(p, proj.inicio + 20) || (p.saida === null && p.admissao < termino - 60),
    );
    const membros =
      proj.id === 1
        ? candidatos.filter((p) => ativa(p, dia("2025-06-02")) || p.admissao < dia("2025-09-01"))
        : sample(candidatos, proj.tamanho);
    const escolhidos = proj.id === 1 ? membros.slice(0, proj.tamanho) : membros;
    for (const p of escolhidos) {
      const ini = Math.max(proj.inicio, p.admissao);
      let fim = proj.fim;
      if (p.saida !== null) fim = fim === null ? p.saida : Math.min(fim, p.saida);
      if (fim !== null && fim < ini) continue;
      vincular(proj, p, p.papel, ini, fim);
    }
  }
  // Projeto longo: duas trocas de papel no histórico e uma agendada para dezembro.
  const longo = projetos[0];
  for (const [nome, novoPapel, quando] of [
    ["Carla Ribeiro", "Analista de Sistemas", "2025-10-01"],
    ["Yasmin Ramos", "Tech Lead", "2026-04-01"],
    ["Ana Martins", "Tech Lead", "2026-12-01"],
  ]) {
    const p = pessoaPorNome.get(nome);
    const atual = equipe.find((e) => e.projetoId === longo.id && e.colaboradorId === p.id);
    if (!atual) continue;
    const troca = dia(quando);
    atual.dataSaida = data(troca - 1);
    const v = vinculos.get(p.id).find((x) => x.projetoId === longo.id);
    v.fim = troca - 1;
    vincular(longo, p, novoPapel, troca, null);
  }
  // Novato: entrou na equipe da Agenda Online em novembro, ainda sem valor/hora.
  vincular(projetos[4], NOVATO, "QA", dia("2026-11-03"), null);

  // ------------------------------------------------ sprints (quinzenais) e tarefas
  const sprints = [];
  const tarefas = [];
  const responsaveis = [];
  const tarefasPorProjeto = new Map();
  for (const proj of projetos) {
    const ultimo = Math.min(proj.fim ?? HOJE + 13, HOJE + 13);
    const lista = [];
    const membros = [
      ...new Set(equipe.filter((e) => e.projetoId === proj.id).map((e) => e.colaboradorId)),
    ];
    for (let ini = proj.inicio, k = 1; ini <= ultimo; ini += 14, k++) {
      const fimSprint = ini + 13;
      const id = sprints.length + 1;
      const encerrada = fimSprint < HOJE;
      sprints.push({
        id,
        projetoId: proj.id,
        nome: `Sprint ${k}`,
        descricao:
          k === 1
            ? "Configuração do ambiente, levantamento detalhado e primeiras telas."
            : `${pick(["Entrega", "Evolução", "Correções e ajustes", "Melhorias"])} de ${pick(TITULOS).toLowerCase()} e ${pick(TITULOS).toLowerCase()}.${encerrada ? " Homologado com o cliente." : ""}`,
        dataInicio: data(ini),
        dataFim: data(fimSprint),
        statusRegistro: proj.fim !== null && encerrada && chance(0.5) ? "INATIVO" : "ATIVO",
        origem: "MANUAL",
        createdAt: data(Math.min(ini - 3, HOJE)),
      });
      for (let t = 0, qtd = proj.id === 1 ? 3 : int(2, 3); t < qtd; t++) {
        const tid = tarefas.length + 1;
        let status;
        if (ini > HOJE) status = "PLANEJADA";
        else if (encerrada)
          status = pick(["CONCLUIDA", "CONCLUIDA", "CONCLUIDA", "CONCLUIDA", "CANCELADA"]);
        else status = pick(["EM_ANDAMENTO", "EM_ANDAMENTO", "PLANEJADA", "CONCLUIDA"]);
        if (proj.fim !== null && status !== "CONCLUIDA") status = encerrada ? "CANCELADA" : status;
        const inicioTarefa = status === "PLANEJADA" ? null : Math.min(ini + int(0, 3), HOJE);
        tarefas.push({
          id: tid,
          projetoId: proj.id,
          sprintId: id,
          titulo: pick(TITULOS),
          descricao: chance(0.7)
            ? "Critério de aceite combinado na reunião de planejamento."
            : null,
          status,
          minutosEstimados: chance(0.06) ? null : pick([2, 4, 6, 8, 12, 16, 24]) * 60,
          correcao: chance(0.15),
          dataInicio: inicioTarefa === null ? null : data(inicioTarefa),
          dataConclusao:
            status === "CONCLUIDA"
              ? data(Math.max(inicioTarefa, Math.min(inicioTarefa + int(1, 9), HOJE - 1)))
              : null,
          statusRegistro: status === "CANCELADA" ? "INATIVO" : "ATIVO",
          origem: "MANUAL",
          createdAt: data(Math.min(ini - 1, HOJE)),
        });
        for (const c of sample(membros, chance(0.1) ? 2 : 1))
          responsaveis.push({ tarefaId: tid, colaboradorId: c });
        lista.push({ id: tid, ini, fim: fimSprint, status });
      }
    }
    tarefasPorProjeto.set(proj.id, lista);
  }

  // ------------------------------------------------ apontamentos
  const projetoPorId = new Map(projetos.map((p) => [p.id, p]));
  const apontamentos = [];
  for (const p of pessoas) {
    const lista = vinculos.get(p.id);
    if (!lista.length) continue;
    for (let d = Math.max(INICIO, p.admissao); d <= Math.min(ULTIMO, p.saida ?? ULTIMO); d++) {
      if (fimDeSemana(d)) continue;
      const ativos = lista.filter((v) => {
        const proj = projetoPorId.get(v.projetoId);
        return v.ini <= d && d <= v.fim && d <= (proj.fim ?? ULTIMO);
      });
      if (!ativos.length) continue;
      // O arquiteto passa por vários projetos no dia; os demais lançam em parte dos dias.
      const lanca = p === TIAGO ? chance(0.75) : chance(0.32);
      if (!lanca) continue;
      const escolhidos =
        p === TIAGO
          ? sample(ativos, Math.min(ativos.length, int(3, 5)))
          : sample(ativos, Math.min(ativos.length, int(1, 2)));
      let restante = int(12, 16); // meias horas (6 h a 8 h no dia)
      escolhidos.forEach((v, k) => {
        const ultimoProjeto = k === escolhidos.length - 1;
        const meias = ultimoProjeto
          ? restante
          : Math.max(2, Math.min(restante - 2 * (escolhidos.length - k - 1), int(2, 8)));
        restante -= meias;
        if (meias <= 0) return;
        const idade = HOJE - d;
        const r = rnd();
        let status =
          idade > 60
            ? r < 0.85
              ? "FATURADO"
              : "APROVADO"
            : idade > 20
              ? r < 0.45
                ? "FATURADO"
                : r < 0.9
                  ? "APROVADO"
                  : "PENDENTE"
              : r < 0.35
                ? "APROVADO"
                : "PENDENTE";
        if (status === "FATURADO" && !temValorHora(p.id, d)) status = "APROVADO";
        const candidatas = tarefasPorProjeto
          .get(v.projetoId)
          .filter(
            (t) => t.ini <= d && d <= t.fim + 3 && !["PLANEJADA", "CANCELADA"].includes(t.status),
          );
        const tarefa = candidatas.length && chance(0.8) ? pick(candidatas) : null;
        apontamentos.push({
          colaboradorId: p.id,
          projetoId: v.projetoId,
          tarefaId: tarefa?.id ?? null,
          data: data(d),
          horas: meias / 2,
          status,
          descricao: tarefa
            ? pick(ATIVIDADES)
            : pick([
                "Reunião de alinhamento com o cliente.",
                "Daily e planejamento da sprint.",
                "Apoio ao time em dúvidas técnicas.",
                "Refinamento do backlog e estimativas.",
              ]),
          createdAt: new Date(d * DIA + int(17, 20) * 3600000),
        });
      });
    }
  }
  apontamentos.sort((a, b) => a.data - b.data || a.colaboradorId - b.colaboradorId);
  apontamentos.forEach((a, i) => (a.id = i + 1));

  // Horas contratadas e valor a partir do consumo planejado de cada projeto.
  for (const proj of projetos) {
    const horas = apontamentos
      .filter((a) => a.projetoId === proj.id)
      .reduce((s, a) => s + a.horas, 0);
    proj.horasContratadas = Math.max(8, Math.round(horas / proj.consumo / 4) * 4);
    proj.valorProjeto = Math.round(proj.horasContratadas * pick([95, 110, 120, 135, 150]));
  }
  await inserir(
    "projeto",
    projetos.map((p) => ({
      id: p.id,
      nome: p.nome,
      clienteId: p.clienteId,
      tipoContrato: p.tipoContrato,
      horasContratadas: p.horasContratadas,
      valorProjeto: p.valorProjeto,
      status: p.status,
      dataInicio: data(p.inicio),
      createdAt: data(p.inicio - 7),
    })),
  );
  await inserir("projetoColaborador", equipe);
  await inserir("sprint", sprints);
  await inserir(
    "tarefa",
    tarefas.map(({ ...t }) => t),
  );
  await inserir("tarefaResponsavel", responsaveis);
  log(
    `${projetos.length} projetos, ${equipe.length} vínculos, ${sprints.length} sprints, ${tarefas.length} tarefas`,
  );
  await inserir("apontamentoHora", apontamentos, 1000);
  log(`${apontamentos.length} apontamentos`);

  // ------------------------------------------------ histórico de apontamentos
  const pessoaPorId = new Map(pessoas.map((p) => [p.id, p]));
  const tarefaPorId = new Map(tarefas.map((t) => [t.id, t]));
  const foto = (a, extra = {}) => ({
    colaboradorId: a.colaboradorId,
    colaboradorNome: pessoaPorId.get(a.colaboradorId).nome,
    projetoId: a.projetoId,
    projetoNome: projetoPorId.get(a.projetoId).nome,
    tarefaId: a.tarefaId,
    tarefaTitulo: a.tarefaId ? tarefaPorId.get(a.tarefaId).titulo : null,
    data: a.data.toISOString().slice(0, 10),
    horas: a.horas,
    status: a.status,
    descricao: a.descricao,
    ...extra,
  });
  const historico = [];
  for (let k = 0; k < 32; k++) {
    const a = pick(apontamentos.filter((x) => x.status !== "FATURADO"));
    const excluido = k % 4 === 3;
    const anterior = foto(a, {
      horas: excluido ? a.horas : Math.max(0.5, a.horas + pick([-1, 1, 2])),
      descricao: excluido ? "Lançado em duplicidade." : a.descricao,
      status: "PENDENTE",
    });
    const novo = excluido ? null : foto(a);
    const alvo = novo ?? anterior;
    historico.push({
      apontamentoId: excluido ? apontamentos.length + 1000 + k : a.id,
      situacao: excluido ? "EXCLUIDO" : "MODIFICADO",
      colaboradorId: alvo.colaboradorId,
      colaboradorNome: alvo.colaboradorNome,
      projetoId: alvo.projetoId,
      projetoNome: alvo.projetoNome,
      tarefaId: alvo.tarefaId,
      tarefaTitulo: alvo.tarefaTitulo,
      data: a.data,
      horas: alvo.horas,
      status: alvo.status,
      descricao: alvo.descricao,
      dadosAnteriores: anterior,
      dadosNovos: novo,
      usuarioId: pick([1, 2]),
      createdAt: new Date(a.createdAt.getTime() + int(1, 5) * DIA),
    });
  }
  await inserir("historicoApontamento", historico);

  // ------------------------------------------------ premiação: versões das regras e avaliações
  const versoes = { DEV: [], PO_SM: [] };
  for (let mes = 0; mes < 11; mes++)
    for (const categoria of ["DEV", "PO_SM"]) {
      const { nome, categoria: _c, ...modelo } = premiacaoTemplates[categoria];
      const publicada = new Date(Date.UTC(2025, mes, 5, 13));
      // A empresa começou sem faixas; a partir de maio de 2025 passou a usar faixas de nota.
      const definicao = {
        ...modelo,
        faixas:
          mes < 4
            ? []
            : [
                { minimo: 9, maximo: 10, percentual: 100 },
                { minimo: 7.5, maximo: 8.5, percentual: 80 },
                { minimo: 6, maximo: 7, percentual: 50 },
                { minimo: -100, maximo: 5.5, percentual: 0 },
              ],
      };
      versoes[categoria].push({
        inicio: publicada,
        regra: await prisma.regraPremiacao.create({
          data: {
            nome: `${nome} — revisão de ${publicada.toISOString().slice(0, 7)}`,
            categoria,
            definicao,
            criadoPorId: mes % 3 ? 1 : 2,
            createdAt: publicada,
          },
        }),
      });
    }
  const regraVigente = (categoria) => versoes[categoria].at(-1).regra;
  const avaliados = [];
  const comps = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const candidatosPremio = pessoas.filter(
    (p) => !p.saida && p !== NOVATO && vinculos.get(p.id).length,
  );
  for (const comp of comps)
    for (const p of sample(candidatosPremio, comp === "2026-10" ? 6 : 4)) avaliados.push([p, comp]);
  avaliados.push([TIAGO, "2026-09"]);
  let avaliacoes = 0;
  const chaves = new Set();
  for (const [p, comp] of avaliados) {
    const ini = dia(`${comp}-01`);
    const fimMes = dia(competencia(ini + 31) + "-01") - 1;
    // Projetos com horas no mês e a categoria de cada papel exercido neles (como na tela:
    // Product Owner, Scrum Master, Gerente de Projeto e Tech Lead são PO/SM; os demais, Dev).
    const comHoras = new Set(
      apontamentos
        .filter((a) => a.colaboradorId === p.id && competencia(Math.floor(a.data / DIA)) === comp)
        .map((a) => a.projetoId),
    );
    const categoriasPorProjeto = new Map();
    for (const v of vinculos.get(p.id))
      if (comHoras.has(v.projetoId) && v.ini <= fimMes && v.fim >= ini)
        categoriasPorProjeto.set(v.projetoId, [
          ...(categoriasPorProjeto.get(v.projetoId) ?? []),
          categoriaDoPapel(v.papel),
        ]);
    const contagem = { DEV: 0, PO_SM: 0 };
    for (const lista of categoriasPorProjeto.values())
      for (const c of new Set(lista)) contagem[c] += 1;
    const categoria = contagem.PO_SM > contagem.DEV ? "PO_SM" : "DEV";
    const projetoIds = [...categoriasPorProjeto]
      .filter(([, lista]) => lista.includes(categoria))
      .map(([id]) => id);
    const chave = `${p.id}|${comp}|${categoria}`;
    if (chaves.has(chave) || !projetoIds.length) continue;
    chaves.add(chave);
    const regra = regraVigente(categoria);
    const concluida = comp !== "2026-10";
    // Mês comum: quase tudo sem ocorrência, de zero a duas ocorrências com evidência.
    const criterios = regra.definicao.criterios;
    const comOcorrencia = new Set(
      sample(
        criterios.filter((c) => c.chave !== "notificacoes" || chance(0.15)),
        pick([0, 0, 1, 1, 1, 2]),
      ).map((c) => c.chave),
    );
    const naoAplicavel = (c) =>
      categoria === "PO_SM" && c.chave.startsWith("impedimento") && chance(0.5);
    const conferidos = concluida ? criterios.length : int(3, criterios.length - 2);
    const manual = concluida && avaliacoes % 7 === 3;
    const identity = { colaboradorId: p.id, competencia: comp, categoria };
    const dados = {
      projetoIds,
      sprintIds: sprints
        .filter(
          (s) =>
            projetoIds.includes(s.projetoId) &&
            Math.floor(s.dataInicio / DIA) >= ini - 13 &&
            Math.floor(s.dataInicio / DIA) < ini + 31,
        )
        .map((s) => s.id),
      respostas: criterios.map((c, i) => {
        if (i >= conferidos) return { chave: c.chave, situacao: "PENDENTE", evidencia: "" };
        if (comOcorrencia.has(c.chave))
          return { chave: c.chave, situacao: "SIM", evidencia: EVIDENCIAS[categoria][c.chave] };
        if (naoAplicavel(c))
          return {
            chave: c.chave,
            situacao: "NA",
            evidencia: "Não houve impedimentos registrados no mês.",
          };
        return { chave: c.chave, situacao: "NAO", evidencia: "" };
      }),
      percentualBase: pick([5, 10]),
      percentualInformado: manual ? 100 : null,
      justificativaPercentual: manual
        ? "Elegibilidade ajustada pela diretoria: entrega crítica antecipada a pedido do cliente."
        : "",
      observacoes: concluida ? "" : "Aguardando o fechamento das sprints do mês.",
    };
    const conteudo = await buildAwardContent(prisma, identity, regra, dados, admin);
    await prisma.avaliacaoPremiacao.create({
      data: {
        ...identity,
        regraId: regra.id,
        conteudo,
        criadoPorId: 1,
        ...(concluida
          ? { status: "CONCLUIDA", concluidoPorId: 1, concluidoEm: data(ini + 40) }
          : {}),
      },
    });
    avaliacoes++;
  }
  log(`22 versões de regras e ${avaliacoes} avaliações de premiação`);

  // ------------------------------------------------ histórico de importações (mais de 10)
  const importacoes = [];
  for (let i = 0; i < 14; i++) {
    const ini = dia("2025-02-03") + i * 45;
    const falhou = i % 5 === 3;
    const linhas = int(12, 60);
    const projs = sample(
      projetos.filter((p) => p.inicio <= ini + 30),
      int(1, 3),
    );
    importacoes.push({
      usuarioId: pick([1, 2]),
      arquivo: `horas_${competencia(ini)}.xlsx`,
      status: falhou ? "FALHOU" : "CONCLUIDA",
      mensagem: falhou ? "A planilha tem linhas com erro. Nenhum apontamento foi gravado." : null,
      linhas,
      importados: falhou ? 0 : linhas,
      comErro: falhou ? 2 : 0,
      horas: falhou ? 0 : Math.round(linhas * 6.5 * 100) / 100,
      periodoInicio: data(ini),
      periodoFim: data(ini + 27),
      projetos: projs.map((x) => ({ id: x.id, nome: x.nome })),
      erros: falhou
        ? [
            { linha: 4, coluna: "Data", mensagem: "Data inválida." },
            { linha: 9, coluna: "E-mail do colaborador", mensagem: "Colaborador não encontrado." },
          ]
        : [],
      createdAt: new Date((ini + 30) * DIA + 14 * 3600000),
    });
  }
  await inserir("importacaoApontamentos", importacoes);

  // ------------------------------------------------ sequências e estatísticas
  const comSequencia = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'id' AND column_default LIKE 'nextval%'`;
  for (const { table_name } of comSequencia)
    await prisma.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT max(id) FROM ${tabela(table_name)}), 0) + 1, false)`,
      tabela(table_name),
    );
  for (const { tablename } of tabelas)
    await prisma.$executeRawUnsafe(`ANALYZE ${tabela(tablename)}`);

  // ------------------------------------------------ relatórios gerados (mais de 20), pelo serviço
  const pedidos = [
    {
      titulo: "Panorama de 2025 e 2026",
      dataInicio: "2025-01-01",
      dataFim: "2026-11-30",
      blocos: ["PROJETOS", "EVOLUCAO", "CUSTO"],
    },
    {
      titulo: "Sustentação do ERP — histórico completo",
      projetoIds: [1],
      blocos: ["PROJETOS", "EQUIPES", "EVOLUCAO", "HORAS"],
    },
  ];
  for (let m = 0; m < 20; m++) {
    const ini = new Date(Date.UTC(2025, m, 1));
    const fim = new Date(Date.UTC(2025, m + 1, 0));
    pedidos.push({
      titulo: `Fechamento de ${ini.toISOString().slice(0, 7)}`,
      dataInicio: ini.toISOString().slice(0, 10),
      dataFim: fim.toISOString().slice(0, 10),
      blocos:
        m % 2
          ? ["PROJETOS", "CLIENTES", "HORAS", "CUSTO"]
          : ["PROJETOS", "HORAS", "INCONSISTENCIAS"],
    });
  }
  for (const pedido of pedidos)
    await relatoriosGeradosService.gerar(relatorioCreateSchema.parse(pedido), admin);
  log(`${pedidos.length} relatórios gerados`);

  // ------------------------------------------------ conferência
  const contagens = {};
  for (const { tablename } of tabelas) {
    const [{ n }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM ${tabela(tablename)}`,
    );
    contagens[tablename] = n;
  }
  console.table(contagens);
  const [h] = await prisma.$queryRaw`
    SELECT sum(horas)::float AS total, max(horas)::float AS maior,
           (SELECT max(s)::float FROM (SELECT sum(horas) s FROM apontamentos_horas GROUP BY "colaboradorId", data) x) AS maior_dia
    FROM apontamentos_horas`;
  log(
    `Horas: ${h.total} no total, maior apontamento ${h.maior} h, maior dia de uma pessoa ${h.maior_dia} h.`,
  );
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
