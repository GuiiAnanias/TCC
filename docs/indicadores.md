# Fórmulas dos indicadores

Os dashboards, a exportação em Excel e a base da premiação usam os mesmos cálculos, feitos no backend (`dashboardService.js`, `custosDashboard.js` e `indicadoresOperacionais.js`). O botão "?" do Dashboard Geral traz o mesmo conteúdo em linguagem de tela. Os filtros disponíveis estão em [filtros.md](filtros.md), e as visões do dashboard em [dashboards.md](dashboards.md).

## Custo e horas

- **Horas**: soma das horas dos apontamentos do recorte.
- **Custo de um apontamento**: custo base (horas × valor/hora vigente) mais a bonificação do papel. A regra completa está em [composicao-financeira.md](composicao-financeira.md).
- **Custo do projeto, do cliente e geral**: soma dos custos dos apontamentos, já arredondados para centavos um a um.
- **Horas sem custo**: horas sem configuração financeira vigente na data. Quando existem, o custo é parcial.

## Assertividade do orçamento

```txt
assertividade do projeto = orçamento do projeto ÷ custo realizado × 100
```

Com orçamento de R$ 100, um custo de R$ 50 resulta em 200%; R$ 100, em 100%; R$ 200, em 50%. Acima de 100%, o custo está abaixo do orçamento. Durante a execução, o resultado é provisório.

O percentual só é calculado quando:

- não há recorte de período, equipe, colaborador ou sprint, porque o orçamento integral não se compara com o custo de parte do projeto;
- o projeto tem horas registradas e nenhuma delas está sem valor/hora;
- orçamento e custo são maiores que zero.

O cartão geral mostra a **média aritmética** dos percentuais dos projetos que atendem a essas condições, sem ponderar pelo orçamento.

## Indicadores de tarefas

Valem para as tarefas do recorte e não dependem dos custos. Tarefas canceladas ficam fora das contagens; as horas trabalhadas nelas continuam no custo e no percentual de correções.

| Indicador                     | Fórmula                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Tarefas sem estimativa        | tarefas sem estimativa ÷ tarefas não canceladas × 100                                |
| Tarefas concluídas sem horas  | tarefas concluídas sem nenhum apontamento ÷ tarefas concluídas × 100                 |
| Assertividade das estimativas | soma das horas estimadas ÷ soma das horas realizadas, nas tarefas comparáveis, × 100 |
| Percentual de correções       | horas em tarefas marcadas como Correção ÷ horas do recorte × 100                     |

- **Tarefas comparáveis**: concluídas, com estimativa e com horas. A razão é feita entre os totais, nunca como média de percentuais.
- **Correções**: horas sem tarefa não podem ser classificadas. Se existirem, o resultado aparece como parcial; se nenhuma hora estiver ligada a tarefa, o indicador fica indisponível.
- Cada indicador sem base de cálculo fica indisponível e mostra o motivo, em vez de exibir zero.

### Efeito dos recortes

- **Período**: a tarefa entra se teve início, conclusão ou apontamento no período. Para contar como concluída, a data de conclusão precisa estar no período; para ser comparável, todas as horas da tarefa também. Tarefas sem datas e sem apontamentos ficam fora.
- **Equipe ou colaborador**: equipe significa o departamento do cadastro do colaborador. A tarefa entra se a pessoa é responsável ou lançou horas nela. Horas e custos consideram só os apontamentos dessa pessoa ou departamento, mas a estimativa não é dividida entre pessoas: o cartão passa a "Assertividade das tarefas (contexto)", calculado com as horas completas das tarefas.
- **Sprint**: considera as tarefas da sprint e os apontamentos ligados a elas.

## Auditoria

Cada ocorrência aponta o registro que precisa de conferência:

| Ocorrência                 | Quando aparece                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| Sem remuneração            | Apontamento sem valor/hora vigente na data                         |
| Sem participação na equipe | Apontamento de quem não tinha participação no projeto naquela data |
| Horas sem tarefa           | Apontamento sem tarefa; a classificação de correção é desconhecida |
| Tarefa sem estimativa      | Tarefa não cancelada sem estimativa                                |
| Tarefa concluída sem horas | Tarefa concluída sem apontamento                                   |

As duas primeiras somam as **inconsistências** de custo do projeto. A falta de regra de bonificação não é ocorrência: aplica-se 0%. Na seção Auditoria operacional, o ranking ordena os projetos pela assertividade do orçamento, do menor percentual para o maior, com os indisponíveis no fim. O Ranking de inconsistências, separado, ordena pela quantidade de ocorrências ([dashboards.md](dashboards.md)).

## Conferência com o seed

O README traz os resultados esperados do Dashboard Geral com os dados de demonstração e alterações manuais para observar cada fórmula. `pnpm run test:seed-db`, na pasta `backend`, confere esses números num schema temporário.
