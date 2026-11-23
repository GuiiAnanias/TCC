# Apontamentos de horas e faturamento

Cada apontamento registra horas já trabalhadas por um colaborador em um projeto, com tarefa opcional. É a base dos custos, dos dashboards e da exportação em Excel. Os lançamentos são feitos na tela **Apontamento de Horas** ou pela importação de planilha (seção "Importação e exportação em Excel" do README), que segue as mesmas regras.

## Campos e validações

| Campo       | Regra                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Colaborador | Precisa estar ativo para receber novas horas                                          |
| Projeto     | Precisa estar Ativo para receber novas horas ou receber um apontamento transferido    |
| Tarefa      | Opcional; precisa ser do mesmo projeto. Um novo vínculo exige tarefa e projeto ativos |
| Data        | Não pode ser posterior a hoje (fuso de São Paulo)                                     |
| Horas       | Maior que zero, até 999,99, com no máximo duas casas decimais                         |
| Status      | Pendente (padrão), Aprovado ou Faturado                                               |
| Descrição   | Obrigatória, com ao menos 3 caracteres                                                |

Regras que consideram outros registros:

- **Limite diário**: a soma das horas de um colaborador no mesmo dia, em todos os projetos, não pode passar de 24 h.
- **Equipe na data**: para criar um apontamento, transferi-lo de projeto ou mudar sua data, o projeto precisa ter ao menos um colaborador ativo com participação vigente na data das horas (detalhes em [equipe-projetos.md](equipe-projetos.md)). Não precisa ser a pessoa do apontamento; a auditoria do dashboard sinaliza quem lançou horas fora da equipe.
- Corrigir um apontamento antigo sem mudar projeto nem data preserva o fluxo histórico, mesmo que a pessoa ou o projeto tenham sido inativados depois.

As gravações usam transação serializável: dois lançamentos simultâneos não conseguem, juntos, ultrapassar o limite diário.

## Status e faturamento

| Status   | Significado                     | Edição e exclusão                  |
| -------- | ------------------------------- | ---------------------------------- |
| Pendente | Lançado, aguardando conferência | Livres                             |
| Aprovado | Conferido                       | Livres                             |
| Faturado | Horas já cobradas do cliente    | Bloqueadas: só o status pode mudar |

A passagem entre status é manual e não tem fluxo obrigatório. Um apontamento pode ser criado ou importado já como Faturado.

### Composição preservada ao faturar

Quando um apontamento passa a Faturado, o banco de dados calcula e grava a composição do custo naquela data (`custoConsolidado`):

- valor/hora e nível da configuração financeira vigente do colaborador;
- papel da participação na equipe do projeto e o percentual de bonificação desse papel;
- custo base, bonificação, custo total e a referência de cada registro usado.

O faturamento é recusado quando falta algum parâmetro ou há mais de um possível: sem valor/hora vigente, sem participação da pessoa na equipe do projeto na data, ou com vigências sobrepostas. A mensagem pede para corrigir as pendências antes de faturar.

Cada faturamento acrescenta uma versão em `historicoCustos`; versões anteriores nunca são apagadas. O cálculo e a gravação ficam em gatilhos do PostgreSQL, então valem para a tela, a importação, a API e escritas diretas no banco.

### Corrigir um apontamento faturado

1. Volte o status para Aprovado e salve. A composição atual deixa de valer, mas continua no histórico.
2. Corrija os dados.
3. Fature de novo: uma nova versão da composição é gravada.

A exclusão segue a mesma regra: um apontamento faturado só pode ser excluído depois de voltar para Aprovado. Apontamentos Pendentes e Aprovados são excluídos de verdade, sem inativação.

### Proteção contra mudanças retroativas

Alterar a equipe do projeto, uma bonificação por papel ou uma configuração financeira é recusado se mudar o custo de algum apontamento já faturado. Para fazer a mudança, volte antes esses apontamentos para Aprovado. A configuração financeira tem ainda as próprias travas de vigência, descritas em [composicao-financeira.md](composicao-financeira.md).

Nos dashboards e no Excel, apontamentos faturados usam a composição preservada; os demais são calculados com as vigências do dia, como explica [indicadores.md](indicadores.md).

`pnpm run check:invoiced-costs`, na pasta `backend`, faz uma verificação somente de leitura dos apontamentos faturados antes de aplicar migrações.

## API

```txt
GET    /api/apontamentos       ?busca=&colaboradorId=&projetoId=&status=&dataInicio=&dataFim=
GET    /api/apontamentos/:id
POST   /api/apontamentos       colaboradorId, projetoId, tarefaId, data, horas, status, descricao
PUT    /api/apontamentos/:id   campos parciais
DELETE /api/apontamentos/:id   exclui (recusado se Faturado)
```

A busca procura na descrição. Conflitos de faturamento respondem 409 com a orientação para o usuário, sem expor mensagens internas do banco.
