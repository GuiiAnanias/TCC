# Estados e contratos dos projetos

## Tipos de contrato

Novos projetos usam **Fee mensal**, **Escopo semiaberto** ou **Squad**. A escolha é obrigatória; não existe conversão automática dos antigos Fixo/Horas/Fechado. A classificação do contrato não cria cobrança recorrente nem muda a fórmula de custo dos apontamentos.

## Estados e operações

| Estado    | Novas horas, tarefas, sprints e alterações de equipe   | Consulta do histórico | Reativação                   |
| --------- | ------------------------------------------------------ | --------------------- | ---------------------------- |
| Ativo     | Permitidas, respeitando as validações de cada operação | Disponível            | Já está ativo                |
| Pausado   | Bloqueadas                                             | Disponível            | Manual, na edição do projeto |
| Encerrado | Bloqueadas                                             | Disponível            | Manual, na edição do projeto |
| Cancelado | Bloqueadas                                             | Disponível            | Manual, na edição do projeto |

O cadastro cria o projeto como Ativo. Na edição, é possível mudar o estado, inclusive voltar para Ativo, sem recriar projeto, tarefas ou vínculos. Reativar não reativa automaticamente colaboradores nem vínculos de equipe encerrados.

As correções históricas de apontamentos já existentes mantêm o fluxo anterior e as proteções de custos faturados. Transferir um apontamento para outro projeto exige que o destino esteja Ativo. Alterar o estado do projeto não altera os valores históricos nem remove registros.

A ação **Encerrar** da listagem muda o estado para Encerrado e pede confirmação. Não exclui o projeto. A decisão sobre exclusão definitiva condicionada continua para uma entrega separada.

O dashboard geral abre com o filtro Ativo. É possível selecionar outro estado ou Todos os estados; Limpar retorna ao recorte inicial de ativos. Os dashboards individuais e o Excel mostram o estado correspondente e permitem consultar históricos de projetos não ativos.

## Seed e migração do ambiente de demonstração

Foi autorizada a recriação dos dados fictícios. A seed mantém seis projetos, com os três tipos de contrato e os quatro estados: Portal e Pendências em Fee mensal, Mobile e Planejamento em Escopo semiaberto e Integração e Histórico em Squad. Mobile começa Pausado, Planejamento Cancelado e Histórico Encerrado. Os demais começam Ativos.

A seed continua aditiva: executá-la novamente preserva as edições existentes. Apagar dados ocorre somente em uma recriação explicitamente executada pelo responsável, não dentro da seed ou da migração.

A migração cria um enum exclusivo dos projetos, mantendo Ativo/Inativo para clientes, colaboradores e outros cadastros. Também substitui os tipos de contrato antigos. Se encontrar classificações antigas, ela **interrompe sem apagá-las ou convertê-las**. Para este ambiente local descartável, a preparação é:

```powershell
# Somente no banco local fictício explicitamente autorizado.
# Conferir DATABASE_URL e parar a API antes de atualizar o Prisma no Windows.
cd backend
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate reset --force --skip-seed --skip-generate
node prisma/seed.js
```

Não usar esse reset em banco real, compartilhado ou cuja exclusão não tenha sido autorizada. A migração não estabelece correspondência de negócio para registros antigos; nesse cenário seria necessário definir uma migração específica antes da aplicação.

## Validação

Os testes cobrem novos tipos e estados, rejeição das classificações antigas, separação dos estados de colaboradores, encerramento, reativação, filtros, consulta de custos históricos e bloqueio de novas horas/tarefas/sprints/equipe. As integrações usam schemas temporários isolados do banco da interface.
