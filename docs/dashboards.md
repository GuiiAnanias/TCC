# Visões dos dashboards

O Dashboard Geral resume todos os projetos do recorte. As visões por projeto e por colaborador detalham uma entidade. Todas usam os mesmos apontamentos e o mesmo cálculo de custo.

## Acesso pelo menu

- **Dashboard Geral**: indicadores do recorte, com as seções abaixo.
- **Visão por projeto** e **Visão por colaborador**: sem uma escolha anterior, abrem numa tela para escolher o projeto ou o colaborador. A lista traz também projetos não ativos e colaboradores inativos, para consulta do histórico. Depois da escolha, o seletor no topo troca de entidade sem voltar ao menu.
- Os nomes nas tabelas do Dashboard Geral continuam levando ao dashboard de cada projeto.

## Apontamentos com custo incompleto

Quando há apontamentos sem participação na equipe do projeto na data das horas (custo sem bonificação) ou sem valor/hora vigente (horas sem custo), o Dashboard Geral mostra o aviso "apontamentos com custo incompleto", logo abaixo dos indicadores. Cada linha traz o colaborador, o projeto, a data, o problema e um botão:

- **Ajustar equipe** abre a equipe do projeto (`/projetos?equipe=<projeto>&colaborador=<colaborador>&data=<dia>`). Se a pessoa nunca participou do projeto, o formulário já vem com ela e a data; se participou em outro período, a linha dela fica destacada e a tela orienta a ajustar a data de entrada. Quando a participação já cobre a data, a tela informa que a pendência foi resolvida.
- **Cadastrar valor/hora** abre o financeiro do colaborador (`/colaboradores?financeiro=<colaborador>&data=<dia>`). Sem nenhuma vigência, o início da nova vigência já vem com a data das horas. Se já houver vigências, a tela explica que o histórico não pode ser alterado e que uma nova vigência não cobre datas anteriores.

O aviso mostra até 5 pendências, das mais recentes para as mais antigas; as demais ficam na seção Auditoria operacional, que usa os mesmos links.

## Visão em gráficos

Logo abaixo da barra de filtros, antes dos indicadores, o Dashboard Geral mostra sete gráficos com o mesmo recorte dos cartões: seis pequenos, em duas linhas de três, e o de orçamento × custo ocupando a linha toda embaixo deles. Todos respondem aos filtros e mostram os valores ao passar o mouse; os números também estão nas tabelas das seções de detalhe.

| Gráfico                           | Forma                       | O que mostra                                                                                  |
| --------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| Custo por mês                     | Colunas empilhadas          | Custo base e bonificação dos apontamentos de cada mês, com o total no topo e as horas na dica |
| Horas por status do apontamento   | Rosca                       | Horas pendentes, aprovadas e faturadas, com valor e percentual na legenda                     |
| Tarefas por status                | Rosca                       | Tarefas planejadas, em andamento, concluídas e canceladas                                     |
| Custo por cliente                 | Barras ordenadas            | Do maior para o menor custo                                                                   |
| Horas por equipe                  | Barras ordenadas            | Horas por departamento do colaborador                                                         |
| Ocorrências de auditoria por tipo | Barras ordenadas            | Quantidade de ocorrências de cada tipo da auditoria                                           |
| Orçamento × custo por projeto     | Barras horizontais em pares | Orçamento integral e custo do recorte dos projetos de maior custo (até 8)                     |

- As séries por mês e por status vêm da API (`evolucao` e `apontamentosPorStatus` em `GET /api/dashboard`) e somam exatamente as horas e o custo do resumo.
- Com filtro de período, equipe, colaborador ou sprint, o custo do gráfico de orçamento é só o do recorte; o orçamento é sempre o valor integral do projeto, e o gráfico avisa isso.
- Nos rankings, com mais de 8 categorias as menores são somadas em "Outros".
- O custo por mês mostra no máximo os 12 últimos meses com apontamentos, com um aviso para usar o período quando houver meses anteriores. O valor no topo de cada coluna aparece com até 6 meses; com mais, fica na dica.
- As colunas da grade seguem a largura da área dos gráficos: três, duas ou uma, e menos colunas com o texto maior (Aa).
- As cores seguem uma paleta categórica testada para daltonismo, com uma versão para o tema claro e outra para o escuro. Cada categoria tem sempre a mesma cor; os rótulos e legendas mostram os valores, então a leitura não depende só da cor.
- O gráfico do Comparativo por projeto passou a usar um único eixo (custo base e bonificação); as horas aparecem na dica e na tabela, em vez de um segundo eixo no mesmo gráfico.

## Seções do Dashboard Geral

| Seção                      | O que mostra                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comparativo por projeto    | Custo por projeto em gráfico; horas e custos na tabela                                                                                                   |
| Auditoria operacional      | Ocorrências detalhadas e o ranking pela assertividade do orçamento (menor primeiro)                                                                      |
| Ranking de inconsistências | Projetos do que tem mais para o que tem menos ocorrências, com a contagem por tipo; empate segue a ordem alfabética                                      |
| Resumo por cliente         | Projetos, horas e custos por cliente                                                                                                                     |
| Resumo por equipe          | Por departamento: colaboradores, projetos, horas, custo base, bonificação, custo total e pendências nas horas (sem valor/hora, sem equipe ou sem tarefa) |

O ranking de inconsistências usa os mesmos tipos da auditoria: sem remuneração, sem participação na equipe, horas sem tarefa, tarefa sem estimativa e tarefa concluída sem horas. O total de cada projeto soma as ocorrências exibidas na auditoria.

## Equipe é o departamento

Decisão de 07/11/2026: equipe, no filtro e no resumo, é o departamento do cadastro do colaborador. Apontamentos de quem não tem departamento aparecem em "Sem departamento".

Cada apontamento pertence a um único colaborador, então horas e custos entram uma vez só: a soma das equipes fecha com o total do dashboard, mesmo em tarefas com vários responsáveis. As ocorrências de tarefas (sem estimativa, concluída sem horas) não entram nas pendências das equipes, porque uma tarefa pode ter responsáveis de departamentos diferentes.

## Evolução do projeto

A visão por projeto abre na aba **Evolução**: um gráfico com o custo de cada mês (base e bonificação), a linha do custo acumulado e a linha do orçamento integral. Abaixo do gráfico, a tabela traz os mesmos números: horas, custo base, bonificação, custo do mês, custo acumulado e quanto ele representa do orçamento.

- Sem apontamentos no recorte, a aba mostra um aviso no lugar do gráfico.
- Com período ou sprint, o acumulado considera só os apontamentos do recorte; o percentual continua comparando com o orçamento integral.
- O último custo acumulado é igual ao custo total do projeto no mesmo recorte.

API: `GET /api/dashboard/projetos/:id` passa a devolver `evolucao` (mês, horas, custo base, bonificação, custo, custo acumulado, percentual do orçamento e quantidade de apontamentos). `GET /api/dashboard` devolve `equipes` e `rankingInconsistencias`.

## Atualização dos dados

Decisão de 07/11/2026: os dashboards não se atualizam sozinhos. O botão **Atualizar** recarrega os indicadores e as opções dos filtros. Assim, a tela não fica consultando o banco em segundo plano, e o que está na tela continua igual ao que foi exportado até a pessoa pedir uma atualização.
