# Interface

O front é uma aplicação React em português, com tema claro (padrão) e escuro. A fonte é a IBM Plex Sans, servida pelo próprio sistema (licença OFL em `frontend/src/assets/fonts`), então a tela fica igual com ou sem internet. Sem login, qualquer endereço interno leva à tela de acesso.

## Estrutura comum

- **Menu lateral**, em três grupos: Análise (Dashboard Geral, Visão por projeto, Visão por colaborador e Relatórios), Cadastros (Clientes, Colaboradores, Remuneração e Projetos) e Operação (Apontamento de Horas, Tarefas e sprints, Premiação e Importar horas). No rodapé ficam o usuário logado e o botão Sair.
- O menu pode ser recolhido para mostrar só os ícones; o nome de cada tela aparece ao passar o mouse e os grupos viram linhas finas. A escolha fica salva no navegador; em telas de até 860 px ele começa recolhido.
- **Barra superior**, fixa ao rolar: o botão **Atualizar** (recarrega os dados da tela), o botão **Aa** (tamanho do texto) e o de tema. Tema e tamanho do texto ficam salvos no navegador. Na troca de tema, o novo tema se espalha em círculo a partir do botão; com a opção do sistema de reduzir animações, ele troca direto.
- **Ajuda**: o botão "?" ao lado do título abre a explicação da tela, com as regras e fórmulas usadas. Fecha com Esc ou pelo botão de fechar.
- Mensagens de sucesso, erro e aviso aparecem abaixo do título. Os erros de validação da API são mostrados com o texto recebido.
- **Visual**: fundo neutro, uma cor de ação (azul) para botões principais, item ativo do menu e foco, e cores de status só onde têm significado (ativo, pendente, faturado, avisos). Os indicadores do dashboard ficam num único quadro dividido por linhas finas; abas são um controle segmentado; status aparecem com um ponto colorido e o nome escrito.

## Acessibilidade

- **Tamanho do texto (Aa)**: na barra superior e nas telas de login e senha. Opções Padrão (100%), Grande (112,5%) e Muito grande (125%). Textos, campos e botões crescem juntos; as grades (filtros, indicadores, blocos do relatório, gráficos) passam a ter menos colunas conforme a largura disponível, sem rolagem lateral. Abre com Enter ou espaço, navega com as setas e fecha com Esc ou clicando fora; o foco volta ao botão.
- O zoom do navegador continua valendo para aumentos maiores.
- Foco visível em todos os controles, status com nome escrito além da cor e gráficos com paleta testada para daltonismo ([dashboards.md](dashboards.md)).

## Cadastros

Clientes, Colaboradores, Remuneração, Projetos e Apontamento de Horas usam o mesmo formato: formulário de cadastro e edição no topo, e tabela com busca e filtro de status embaixo. As ações de cada linha variam:

| Tela                 | Ações na tabela                                                    | Remover                                                     |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Clientes             | Editar                                                             | Inativar                                                    |
| Colaboradores        | Dashboard, Editar, Financeiro (vigências)                          | Inativar                                                    |
| Remuneração          | Editar; abaixo da tabela, a seção Bonificação por papel no projeto | Inativar                                                    |
| Projetos             | Dashboard, Editar, Equipe                                          | Encerrar, ou Excluir definitivamente se não houver vínculos |
| Apontamento de Horas | Editar                                                             | Excluir (não vale para faturados)                           |

Sem nenhum cadastro, a tabela mostra "Nenhum cliente cadastrado", "Nenhum colaborador cadastrado", "Não há itens cadastrados" (Remuneração) ou "Nenhum projeto cadastrado"; com busca ou filtro sem resultado, "Nenhum registro encontrado". Usar um item de remuneração inativo responde "Item inativo na tabela de remuneração e bonificação".

Inativar e excluir pedem confirmação. Cada tela tem a própria ajuda; as regras estão em [clientes.md](clientes.md), [composicao-financeira.md](composicao-financeira.md), [projetos.md](projetos.md), [equipe-projetos.md](equipe-projetos.md), [exclusao-projetos.md](exclusao-projetos.md) e [apontamentos.md](apontamentos.md).

## Dashboards

- **Dashboard Geral**: barra com data inicial, data final, atalhos de período (Mês atual, Últimos 30 dias, Mês anterior e Este ano, aplicados com um clique) e o botão **Filtros**, que abre os demais filtros no mesmo quadro (aplicados por Aplicar filtros e mostrados em etiquetas); em seguida os gráficos, os cartões de resumo (projetos ativos, clientes, custo, horas, assertividade média do orçamento e ocorrências), indicadores operacionais de tarefas e as seções Comparativo por projeto, Auditoria operacional, Ranking de inconsistências, Resumo por cliente e Resumo por equipe. **Exportar Excel** gera a planilha do recorte aplicado.
- **Visão por projeto** e **Visão por colaborador**: pelo menu, abrem numa tela de escolha; também podem ser abertas pela ação Dashboard das listas ou pelos nomes nas tabelas do Dashboard Geral. Mostram o resumo da entidade e as abas Tarefas, Apontamentos, Participação e custos e Auditoria; a do projeto começa pela aba Evolução.

As fórmulas estão em [indicadores.md](indicadores.md), os filtros em [filtros.md](filtros.md) e as visões em [dashboards.md](dashboards.md).

## Outras telas

- **Relatórios**: busca de projetos e clientes, período e blocos; Gerar grava uma cópia dos dados e mostra a prévia, que pode ser personalizada e baixada em PDF ou Excel. A aba Histórico lista os relatórios gerados, com filtros, paginação e download de cada um ([relatorios.md](relatorios.md)).
- **Tarefas e sprints**: escolha do projeto, abas de tarefas e sprints, formulário, filtros e arquivamento ([tarefas-sprints.md](tarefas-sprints.md)).
- **Premiação**: publicação de regras e avaliação mensal por categoria ([premiacao.md](premiacao.md)).
- **Importar horas**: download do modelo, conferência linha a linha, importação da planilha e histórico das importações (README, seção "Importação e exportação em Excel").
- **Login** e **Redefinir senha**: telas públicas ([login.md](login.md), [seguranca.md](seguranca.md)).

## Testes da interface

`pnpm test`, na pasta `frontend`, roda os testes de componentes com jsdom, sem navegador e sem API (as respostas são simuladas). O CI também confere formatação, lint e build.
