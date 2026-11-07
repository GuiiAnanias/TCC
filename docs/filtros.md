# Filtros dos dashboards e da exportação

O Dashboard Geral, os dashboards individuais e o Excel usam o mesmo recorte. O que está aplicado na tela é exatamente o que a API calcula e o que a planilha exporta.

## Filtros por tela

| Filtro                | Dashboard Geral | Dashboard do projeto | Dashboard do colaborador | Excel               |
| --------------------- | --------------- | -------------------- | ------------------------ | ------------------- |
| Período               | Sim             | Sim                  | Sim                      | O aplicado no Geral |
| Cliente               | Sim             | Fixo no projeto      | Não                      | O aplicado no Geral |
| Projetos (vários)     | Sim             | Fixo no projeto      | Sim                      | O aplicado no Geral |
| Colaborador           | Sim             | Não                  | Fixo no colaborador      | O aplicado no Geral |
| Sprint                | Com um projeto  | Sim                  | Não                      | O aplicado no Geral |
| Equipe (departamento) | Sim             | Não                  | Não                      | O aplicado no Geral |
| Status do projeto     | Sim             | Não                  | Não                      | O aplicado no Geral |

O período considera a data dos apontamentos. Com período, equipe, colaborador ou sprint, a assertividade do orçamento fica indisponível, porque o orçamento integral não se compara com o custo de parte do projeto.

## Como os filtros se combinam

- Filtros diferentes se somam (E): por exemplo, cliente A e projeto X mostram X apenas se X for do cliente A.
- Vários projetos são alternativas (OU): o recorte traz cada projeto escolhido, e os totais somam os mesmos valores dos dashboards individuais.
- A lista de projetos acompanha o cliente e o status escolhidos. Ao trocar um deles, os projetos que deixaram de valer saem da seleção.
- Cada sprint pertence a um único projeto. No Dashboard Geral, a sprint fica disponível com exatamente um projeto escolhido e sai da seleção quando os projetos mudam. A API recusa uma sprint que não pertence aos projetos informados, em vez de devolver um recorte vazio sem explicação.
- O Dashboard Geral abre com projetos ativos. Limpar volta a esse recorte inicial. Nos dashboards individuais, Limpar volta a todos os períodos.
- Depois de aplicados, os filtros aparecem em etiquetas acima dos indicadores. O botão Exportar Excel só fica disponível com os filtros aplicados, para a planilha não sair com um recorte diferente da tela.

## API

`GET /api/dashboard`, `GET /api/dashboard/projetos/:id`, `GET /api/dashboard/colaboradores/:id` e `GET /api/relatorios/indicadores.xlsx` aceitam:

| Parâmetro               | Formato                                              |
| ----------------------- | ---------------------------------------------------- |
| `dataInicio`, `dataFim` | `AAAA-MM-DD`; o fim não pode ser anterior ao início  |
| `clienteId`             | código do cliente                                    |
| `projetoIds`            | códigos separados por vírgula (`10,12`) ou repetidos |
| `projetoId`             | um projeto; continua aceito e entra em `projetoIds`  |
| `colaboradorId`         | código do colaborador                                |
| `sprintId`              | código da sprint; precisa pertencer aos projetos     |
| `equipe`                | nome do departamento                                 |
| `statusProjeto`         | `ATIVO`, `PAUSADO`, `ENCERRADO` ou `CANCELADO`       |

Até 50 projetos por consulta. Códigos inválidos, período invertido e sprint de outro projeto respondem 400 com a mensagem do problema.

Exemplo: `GET /api/dashboard?projetoIds=10,12&colaboradorId=5&statusProjeto=ATIVO`.

`GET /api/dashboard/opcoes` devolve clientes, equipes, projetos (com cliente e status), colaboradores e sprints (com o projeto), usados para montar os controles.

No Excel, a aba Resumo lista os filtros aplicados. Com vários projetos, a linha Projetos traz os nomes separados por ponto e vírgula.

## Decisão pendente

O filtro Equipe continua sendo o departamento do colaborador (cadastro do colaborador). A documentação do TCC também pode ser lida como a equipe do projeto (participações com papel e período). Essa escolha muda o resultado do filtro e precisa ser definida antes de qualquer alteração.
