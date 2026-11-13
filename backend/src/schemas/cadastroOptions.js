/**
 * [SCHEMA] Listas fixas dos formulários: cargos, papéis no projeto, níveis de remuneração e
 * departamentos. A API devolve em GET /api/opcoes-cadastro e os schemas usam para validar.
 */

// Cargo descreve a atuação profissional, sem definir remuneração ou papel no projeto.
export const cargosTi = [
  "Product Owner",
  "Scrum Master",
  "Gerente de Projeto",
  "Tech Lead",
  "Líder Técnico",
  "Arquiteto de Software",
  "Analista de Sistemas",
  "Analista de Negócios",
  "Analista de Produto",
  "Desenvolvedor Full Stack",
  "Desenvolvedor Back-end",
  "Desenvolvedor Front-end",
  "Desenvolvedor Mobile",
  "Programador",
  "QA",
  "UI/UX Designer",
  "DevOps",
  "Engenheiro de Dados",
  "DBA",
  "Especialista em Segurança",
  "Suporte Técnico",
];

// Papéis são um catálogo próprio. Especialidades já utilizadas continuam válidas
// para preservar vínculos e regras de bonificação existentes, sem renomeá-los.
export const papeisProjeto = [
  "Dev",
  "Product Owner",
  "Scrum Master",
  "Tech Lead",
  "Líder Técnico",
  "QA",
  "UI/UX Designer",
  "DevOps",
  "Gerente de Projeto",
  "Arquiteto de Software",
  "Analista de Sistemas",
  "Analista de Negócios",
  "Analista de Produto",
  "Desenvolvedor Full Stack",
  "Desenvolvedor Back-end",
  "Desenvolvedor Front-end",
  "Desenvolvedor Mobile",
  "Programador",
  "Engenheiro de Dados",
  "DBA",
  "Especialista em Segurança",
  "Suporte Técnico",
];

// Faixas da carreira; valores/hora são cadastrados pela empresa, nunca inferidos
// do cargo. A escolha dos nomes não atribui valores aos registros existentes.
export const niveisRemuneracao = ["Trainee", "Júnior", "Pleno", "Sênior"].flatMap((nivel) =>
  ["I", "II", "III", "IV", "V"].map((faixa) => `${nivel} ${faixa}`),
);

export const departamentosTi = [
  "Tecnologia",
  "Produto",
  "Desenvolvimento",
  "Qualidade",
  "Dados",
  "Infraestrutura",
  "Segurança da Informação",
  "Suporte",
  "Design",
];
