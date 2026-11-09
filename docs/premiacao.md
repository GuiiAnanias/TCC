# Avaliação de premiação Dev e PO/SM

A tela **Premiação** registra a avaliação mensal de uma pessoa nas categorias Dev ou PO/SM. É um módulo adicional de demonstração: os critérios formam um modelo de exemplo do sistema, montado a partir das abas Dev e PO e SM de uma planilha de avaliação usada no levantamento, e não representam a política de premiação de uma empresa real. A avaliação calcula nota e percentual; não calcula valores em reais, não comprova pagamento e não altera custos de projetos nem a bonificação por papel.

## Critérios dos modelos

Os dois modelos começam com 10 pontos. Cada critério marcado como ocorrência desconta sua dedução uma única vez no mês, independentemente da quantidade de tarefas envolvidas.

**Dev**

| Critério                                                                                     | Dedução |
| -------------------------------------------------------------------------------------------- | ------: |
| Assertividade do tempo estimado inferior a 75%                                               |       1 |
| Tarefas concluídas sem registro de execução                                                  |       1 |
| Horas lançadas após a finalização da sprint                                                  |       1 |
| Tarefas sem estimativa de tempo                                                              |       1 |
| Correção acima de 15% do tempo da tarefa original, com responsabilidade pelo erro verificada |     0,5 |
| Quantidade de tarefas de correção superior a 10% das tarefas                                 |     0,5 |
| Mais de 10% das tarefas entregues fora do prazo                                              |       1 |
| Notificações registradas no período (ausências, comunicação ou comportamento)                |       2 |

**PO/SM**

| Critério                                                           | Dedução |
| ------------------------------------------------------------------ | ------: |
| Impedimentos sem justificativa registrada                          |     0,5 |
| Impedimentos com mais de cinco dias sem resposta ou encaminhamento |       1 |
| Tarefas abertas em sprints finalizadas                             |       1 |
| Tarefas sem estimativa de tempo                                    |       1 |
| Tarefas concluídas sem registro de execução                        |       1 |
| Horas lançadas após a finalização da sprint                        |       1 |
| Tarefas sem data de vencimento                                     |       1 |
| Assertividade do tempo estimado inferior a 75%                     |       1 |
| Tarefas sem os requisitos mínimos definidos                        |       1 |
| Tarefas fora de uma sprint                                         |       1 |

O critério "Tarefas fora de uma sprint" foi mantido porque aparece na aba PO e SM, embora a soma da planilha omita essa linha. Cada critério guarda a referência da célula de origem.

## Regras publicadas

Antes de avaliar, publique uma versão das regras da categoria, partindo do modelo. Uma versão publicada é imutável: mudanças exigem outra versão, e as avaliações existentes continuam com as regras e deduções que usaram.

As faixas que convertem a nota em percentual de elegibilidade não constam da planilha fornecida, por isso os modelos começam sem faixas. Ao publicar, é possível cadastrar faixas com limites inclusivos e sem sobreposição. Percentuais e faixas são configurações da empresa, não valores extraídos da planilha.

## Cálculo

Cada critério é respondido como A conferir, Há ocorrência, Sem ocorrência ou Não aplicável. Há ocorrência e Não aplicável exigem evidência ou justificativa.

```txt
nota             = pontuação-base − deduções dos critérios com ocorrência
elegibilidade    = percentual da faixa da nota, ou o percentual informado manualmente
percentual final = percentual-base × elegibilidade ÷ 100
```

- Enquanto houver critério a conferir, a nota é provisória e não há percentual.
- A nota pode ficar negativa: não existe piso presumido.
- O percentual-base é informado em cada avaliação. Exemplo de cálculo: base 5% e elegibilidade 80% resultam em 4%.
- A elegibilidade informada manualmente exige justificativa e prevalece sobre as faixas. Campo vazio é diferente de zero.
- Sem faixa para a nota e sem percentual informado, o percentual fica indisponível, com o motivo exibido.

## Base de conferência

A avaliação escolhe pessoa, competência (mês), categoria, projetos e, opcionalmente, sprints. Sem sprint escolhida, entram todas as sprints e as tarefas sem sprint dos projetos.

Ao salvar o rascunho, o sistema consulta os dados atuais e grava uma cópia da base: data da consulta, projetos, papéis da pessoa no mês, sprints, tarefas e os indicadores de tarefas do dashboard ([indicadores.md](indicadores.md)).

- **Dev**: tarefas em que a pessoa é responsável ou lançou horas; as horas são as dela no mês. Estimativas usam o contexto completo de tarefas compartilhadas.
- **PO/SM**: tarefas e horas dos projetos e sprints escolhidos, como contexto de gestão, sem atribuir o trabalho à pessoa.

Os indicadores ajudam a conferir, mas as respostas continuam manuais. O sistema não deduz automaticamente notificações, atrasos, impedimentos ou responsabilidade por erro.

## Rascunho, conclusão e reavaliação

- **Rascunho**: pode ser salvo várias vezes; cada gravação atualiza a base. Duas sessões não sobrescrevem o mesmo rascunho sem aviso (a gravação confere a revisão).
- **Concluir**: exige todos os critérios conferidos e preserva exatamente a base e as respostas salvas. Pode ser concluída mesmo sem percentual disponível. Depois disso, a avaliação não muda.
- **Reavaliar**: cria a versão seguinte da mesma pessoa, competência e categoria, a partir da última concluída, com nova conferência. A versão anterior continua no histórico.

Projetos usados em avaliações ficam registrados em `projetos_avaliacoes` e não podem ser excluídos definitivamente ([exclusao-projetos.md](exclusao-projetos.md)).

## API

```txt
GET  /api/premiacoes/modelos
GET  /api/premiacoes/regras
POST /api/premiacoes/regras          nome, categoria (DEV|PO_SM), pontuacaoBase, criterios, faixas
GET  /api/premiacoes                 ?colaboradorId=&competencia=AAAA-MM&categoria=&status=RASCUNHO|CONCLUIDA
GET  /api/premiacoes/:id
POST /api/premiacoes                 colaboradorId, competencia, regraId, anteriorId (reavaliação), dados
PUT  /api/premiacoes/:id             revisao, dados
POST /api/premiacoes/:id/concluir    revisao
```

O seed traz duas regras sem faixas presumidas e duas avaliações de exemplo; o README explica como acrescentá-las a uma base existente.
