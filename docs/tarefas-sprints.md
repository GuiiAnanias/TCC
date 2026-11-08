# Tarefas e sprints

Tarefas e sprints são cadastradas manualmente na tela **Tarefas e sprints**, sempre dentro de um projeto. Servem para planejar o trabalho, ligar as horas lançadas a uma entrega e alimentar os indicadores de tarefas do dashboard. Não há integração com ferramentas externas de gestão.

## Sprints

| Campo      | Regra                                                   |
| ---------- | ------------------------------------------------------- |
| Projeto    | Obrigatório e definitivo: não muda depois de cadastrado |
| Nome       | 3 a 150 caracteres                                      |
| Início/fim | Opcionais; o fim não pode ser anterior ao início        |
| Cadastro   | Ativa ou Arquivada                                      |

As datas da sprint servem ao planejamento: não impedem apontamentos fora do período.

## Tarefas

| Campo              | Regra                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Projeto            | Obrigatório e definitivo                                                                                        |
| Sprint             | Opcional; precisa ser do mesmo projeto e estar ativa para ser escolhida                                         |
| Título             | 3 a 200 caracteres                                                                                              |
| Descrição          | Opcional, até 3.000 caracteres                                                                                  |
| Status             | Planejada (padrão), Em andamento, Concluída ou Cancelada                                                        |
| Estimativa         | Opcional. A tela recebe horas e minutos e grava o total em minutos; vazio é "sem estimativa", zero não é aceito |
| Correção           | Marca o trabalho destinado a corrigir problemas; entra no percentual de correções                               |
| Início e conclusão | Opcionais. A conclusão só existe em tarefa Concluída e não pode ser anterior ao início                          |
| Responsáveis       | Nenhum, um ou vários (até 100, sem repetição)                                                                   |
| Cadastro           | Ativa ou Arquivada                                                                                              |

O status da tarefa descreve o trabalho e é independente do status dos apontamentos (Pendente, Aprovado, Faturado). Ao reabrir ou cancelar uma tarefa concluída, a data de conclusão precisa ser removida.

Para incluir um novo responsável, a pessoa precisa estar ativa e ter participação na equipe do projeto. Responsáveis já gravados continuam visíveis mesmo depois da inativação da pessoa.

## Horas das tarefas

As horas são lançadas em **Apontamento de Horas**, escolhendo uma tarefa do mesmo projeto. Cada apontamento pertence a um único colaborador: os responsáveis da tarefa não recebem cópias das horas, e o total da tarefa soma cada apontamento uma vez. Apontamentos sem tarefa continuam válidos e podem ser vinculados depois pela edição; o sistema não faz atribuição automática.

## Projeto não ativo e arquivamento

- Só projetos Ativos aceitam novas tarefas, novas sprints ou alterações nelas. Projetos pausados, encerrados ou cancelados ficam em consulta.
- Não há exclusão de tarefas nem de sprints pela tela ou pela API. Arquivar preserva o registro, os responsáveis e as horas, e pode ser desfeito com Restaurar.
- Tarefa arquivada não recebe novos vínculos de horas. Sprint arquivada mantém suas tarefas, mas não pode ser escolhida para outras.

Tarefas e sprints têm os campos `origem` e `externalId`. O cadastro pela tela grava `MANUAL`, e o seed grava `DEMO` com identificadores estáveis para não duplicar os exemplos.

## Consulta

A tela filtra por projeto, texto, status da tarefa, sprint e arquivamento. A tabela de tarefas mostra sprint, responsáveis, status, estimativa, horas registradas, início e conclusão; a de sprints mostra período, quantidade de tarefas e situação do cadastro.

## API

```txt
GET  /api/tarefas      ?projetoId=&sprintId=&busca=&status=&statusRegistro=ATIVO|INATIVO
POST /api/tarefas      projetoId, titulo, sprintId, descricao, status, minutosEstimados,
                       correcao, dataInicio, dataConclusao, statusRegistro, responsavelIds
PUT  /api/tarefas/:id  campos parciais; responsavelIds substitui a lista inteira
GET  /api/sprints      ?projetoId=&busca=&statusRegistro=
POST /api/sprints      projetoId, nome, dataInicio, dataFim, statusRegistro
PUT  /api/sprints/:id  campos parciais
```

`GET /api/tarefas` devolve `horasRealizadas`, a soma dos apontamentos ligados a cada tarefa. As gravações usam transação serializável; se outra operação alterar os mesmos dados ao mesmo tempo, a API responde 409 pedindo para atualizar a tela.
