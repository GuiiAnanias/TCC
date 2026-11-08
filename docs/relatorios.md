# Relatórios com prévia

A tela **Relatórios** gera um relatório de um recorte escolhido e grava uma cópia dos dados desse momento, a fotografia. A prévia mostra sempre essa cópia: mudanças posteriores em horas, equipes, vigências ou valores não alteram um relatório já gerado. Para ver os números atuais, gere outro.

## Gerar

| Escolha  | Regra                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Projetos | Um ou vários, até 50. Sem projetos, entram todos os que têm apontamentos ou tarefas no período        |
| Período  | Data inicial, final ou as duas; considera a data dos apontamentos                                     |
| Blocos   | Ao menos um entre Projetos, Clientes, Horas totais, Custo total e Inconsistências; todos vêm marcados |

É obrigatório informar ao menos um filtro (projetos ou período) e um bloco. Projetos de qualquer estado entram: os escolhidos sempre, e os demais quando têm dados no período. Um recorte sem nenhum projeto com dados não gera relatório; a tela pede para ajustar os filtros.

**Cancelar**, durante a geração, para de esperar a resposta. Depois, limpa o formulário e a prévia. Se o servidor já tinha gravado o relatório, ele continua registrado e pode ser aberto pelo endereço `/relatorios/<número>`.

## Blocos

| Bloco           | Conteúdo                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Projetos        | Cliente, estado, orçamento, horas, custo base, bonificação, custo total, assertividade do orçamento e inconsistências |
| Clientes        | Projetos, horas, custo base, bonificação e custo total por cliente                                                    |
| Horas totais    | Total, quantidade de apontamentos, horas sem custo, horas sem tarefa, horas por status e por colaborador              |
| Custo total     | Custo total (marcado como parcial quando há horas sem valor/hora), custo base, bonificação e assertividade média      |
| Inconsistências | Quantidade por tipo e a lista de ocorrências da auditoria                                                             |

Os números seguem as fórmulas do Dashboard Geral ([indicadores.md](indicadores.md)) com o custo atual: valor/hora mais bonificação por papel. Com período, a assertividade do orçamento fica indisponível. Quando a composição financeira mudar, os relatórios novos usarão a regra nova; os já gerados mantêm os valores gravados.

## Fotografia

Cada relatório grava, em `relatorios_gerados`:

- autor (a conta logada), data e hora da geração;
- filtros (`projetoIds`, `dataInicio`, `dataFim`) e blocos escolhidos;
- versão do formato (`versao`, hoje 1), para que relatórios antigos continuem legíveis se o formato mudar;
- o conteúdo: os projetos do recorte e os dados de cada bloco escolhido.

O banco impede alterar ou excluir uma fotografia, inclusive por fora da API. Os projetos do recorte ficam registrados em `relatorios_projetos`, com chave estrangeira restritiva: um projeto que entrou em algum relatório não pode ser excluído definitivamente ([exclusao-projetos.md](exclusao-projetos.md)).

Qualquer conta ativa pode gerar relatórios e abrir os já gerados, como no restante do sistema. O relatório contém custos internos e valor/hora: é de uso interno.

Exportar a fotografia em PDF ou Excel e listar o histórico de relatórios ainda não fazem parte desta tela. A exportação **Exportar Excel** do Dashboard Geral continua igual e não grava fotografia.

## API

```txt
POST /api/relatorios        projetoIds, dataInicio, dataFim, blocos → 201 com a fotografia
GET  /api/relatorios/:id    a mesma fotografia, sem recalcular
```

Exemplo:

```json
{
  "projetoIds": [1, 3],
  "dataInicio": "2026-10-01",
  "dataFim": "2026-10-31",
  "blocos": ["PROJETOS", "HORAS", "CUSTO"]
}
```

Respostas de erro: 400 para pedido inválido (sem filtro, sem bloco, período invertido, projeto inexistente, campo desconhecido), 422 para recorte sem dados, 404 para relatório inexistente e 401 sem login. A resposta traz `id`, `versao`, `filtros`, `blocos`, `autor`, `criadoEm` e `conteudo`.

## Migração e validação

A migração `20261108010000_relatorios_gerados` cria as duas tabelas e os gatilhos; não altera dados existentes. Aplique-a e gere o Prisma Client antes de iniciar a versão atualizada:

```powershell
cd backend
corepack pnpm exec prisma migrate deploy
corepack pnpm run prisma:generate
```

`corepack pnpm run test:reports-db`, na pasta `backend`, usa um schema temporário no PostgreSQL local. Confere os números da fotografia contra o dashboard, os blocos escolhidos, o recorte por período, a recusa do recorte vazio, a cópia inalterada depois de mudar um apontamento, a proteção no banco, o bloqueio da exclusão do projeto e a API autenticada.
