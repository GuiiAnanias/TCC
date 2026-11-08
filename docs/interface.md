# Interface

O front é uma aplicação React em português, com tema escuro (padrão) e claro. Sem login, qualquer endereço interno leva à tela de acesso.

## Estrutura comum

- **Menu lateral**: Dashboard Geral, Visão por projeto, Visão por colaborador, Relatórios, Clientes, Colaboradores, Remuneração, Projetos, Apontamento de Horas, Tarefas e sprints, Premiação e Importar horas. No rodapé ficam o usuário logado e o botão Sair.
- O menu pode ser recolhido para mostrar só os ícones. A escolha fica salva no navegador; em telas de até 860 px ele começa recolhido.
- **Ações da página**: os botões **Atualizar** (recarrega os dados da tela) e de tema ficam no canto superior direito. Ao rolar a página, eles se acomodam no menu lateral, acima do usuário. O tema escolhido fica salvo no navegador.
- **Ajuda**: o botão "?" ao lado do título abre a explicação da tela, com as regras e fórmulas usadas. Fecha com Esc ou pelo botão de fechar.
- Mensagens de sucesso, erro e aviso aparecem abaixo do título. Os erros de validação da API são mostrados com o texto recebido.

## Cadastros

Clientes, Colaboradores, Remuneração, Projetos e Apontamento de Horas usam o mesmo formato: formulário de cadastro e edição no topo, e tabela com busca e filtro de status embaixo. As ações de cada linha variam:

| Tela                 | Ações na tabela                                                    | Remover                                                     |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Clientes             | Editar                                                             | Inativar                                                    |
| Colaboradores        | Dashboard, Editar, Financeiro (vigências)                          | Inativar                                                    |
| Remuneração          | Editar; abaixo da tabela, a seção Bonificação por papel no projeto | Inativar                                                    |
| Projetos             | Dashboard, Editar, Equipe                                          | Encerrar, ou Excluir definitivamente se não houver vínculos |
| Apontamento de Horas | Editar                                                             | Excluir (não vale para faturados)                           |

Inativar e excluir pedem confirmação. Cada tela tem a própria ajuda; as regras estão em [clientes.md](clientes.md), [composicao-financeira.md](composicao-financeira.md), [projetos.md](projetos.md), [equipe-projetos.md](equipe-projetos.md), [exclusao-projetos.md](exclusao-projetos.md) e [apontamentos.md](apontamentos.md).

## Dashboards

- **Dashboard Geral**: filtros aplicados pelo botão Aplicar filtros e mostrados em etiquetas, cartões de resumo (projetos ativos, clientes, custo, horas, assertividade média do orçamento e ocorrências), indicadores operacionais de tarefas e as seções Comparativo por projeto, Auditoria operacional, Ranking de inconsistências, Resumo por cliente e Resumo por equipe. **Exportar Excel** gera a planilha do recorte aplicado.
- **Visão por projeto** e **Visão por colaborador**: pelo menu, abrem numa tela de escolha; também podem ser abertas pela ação Dashboard das listas ou pelos nomes nas tabelas do Dashboard Geral. Mostram o resumo da entidade e as abas Tarefas, Apontamentos, Participação e custos e Auditoria; a do projeto começa pela aba Evolução.

As fórmulas estão em [indicadores.md](indicadores.md), os filtros em [filtros.md](filtros.md) e as visões em [dashboards.md](dashboards.md).

## Outras telas

- **Relatórios**: busca de projetos e clientes, período e blocos; Gerar grava uma cópia dos dados e mostra a prévia, que pode ser personalizada e baixada em PDF ou Excel. A aba Histórico lista os relatórios gerados, com filtros, paginação e download de cada um ([relatorios.md](relatorios.md)).
- **Tarefas e sprints**: escolha do projeto, abas de tarefas e sprints, formulário, filtros e arquivamento ([tarefas-sprints.md](tarefas-sprints.md)).
- **Premiação**: publicação de regras e avaliação mensal por categoria ([premiacao.md](premiacao.md)).
- **Importar horas**: download do modelo, conferência linha a linha e importação da planilha (README, seção "Importação e exportação em Excel").
- **Login** e **Redefinir senha**: telas públicas ([login.md](login.md), [seguranca.md](seguranca.md)).

## Testes da interface

`corepack pnpm test`, na pasta `frontend`, roda os testes de componentes com jsdom, sem navegador e sem API (as respostas são simuladas). O CI também confere formatação, lint e build.
