# Equipe inicial e início dos lançamentos

O projeto pode ser criado sem integrantes. Nesse caso, continua disponível para cadastro, planejamento de tarefas/sprints e consultas, mas não recebe novas horas até ter uma equipe válida.

## Cadastro com vários integrantes

No formulário de novo projeto, abra **Selecionar colaboradores**. A busca aceita nome ou e-mail e apresenta colaboradores ativos. Marque quantas pessoas precisar e informe o papel e a data de entrada de cada uma; a data de início do projeto é usada como preenchimento inicial quando já informada.

A equipe é opcional. Se selecionar alguém, papel e entrada são obrigatórios. Não é permitido repetir um colaborador na mesma equipe inicial. O projeto e os vínculos são gravados na mesma transação: se qualquer vínculo for inválido ou falhar, nenhum cadastro parcial permanece.

A API aceita `equipeInicial` no `POST /api/projetos`:

```json
{
  "clienteId": 1,
  "nome": "Projeto de demonstração",
  "tipoContrato": "SQUAD",
  "horasContratadas": 40,
  "valorProjeto": 4000,
  "dataInicio": "2026-11-01",
  "equipeInicial": [
    { "colaboradorId": 2, "papel": "Dev", "dataEntrada": "2026-11-01" },
    { "colaboradorId": 3, "papel": "QA", "dataEntrada": "2026-11-02" }
  ]
}
```

Sem o campo, ou com uma lista vazia, somente o projeto é criado. A lista aceita até 100 integrantes. Os IDs do exemplo devem ser substituídos pelos cadastros reais do ambiente.

## Edição e histórico

A edição dos dados do projeto mantém a equipe existente. O botão **Gerenciar equipe do projeto**, dentro da edição, abre o painel de equipe. Ele também pode ser acessado pela ação Equipe da listagem.

Nesse painel, novas entradas, saídas e mudanças de papel usam os fluxos de vigência já existentes. A atualização do projeto não recebe uma lista de substituição da equipe: `equipeInicial` é exclusivo da criação, para impedir que salvar o formulário apague participações anteriores. Projetos não ativos mantêm a equipe em consulta; precisam ser reativados para alterá-la.

## Quando as horas ficam liberadas

Para criar um apontamento, transferi-lo para outro projeto ou mudar sua data, o projeto precisa ter pelo menos uma participação de colaborador ativo que inclua a data trabalhada: entrada menor ou igual à data e saída ausente ou maior ou igual à data. Só agendar uma entrada futura não libera horas anteriores. Participações somente de colaboradores inativos não atendem à regra.

Essa regra exige uma equipe mínima do projeto; não exige que a pessoa do apontamento seja aquele integrante. A auditoria já existente continua sinalizando horas de pessoas fora da equipe e a ausência de bonificação/custo aplicável. As regras de faturamento continuam exigindo os parâmetros completos da própria pessoa.

Correções no mesmo apontamento e na mesma data, consultas e históricos permanecem disponíveis. O custo faturado continua protegido e não é reprocessado automaticamente. Desativar colaboradores ou encerrar participações não apaga horas anteriores.

A mesma exigência vale no cadastro manual e na importação Excel já existente, inclusive pela API. A prévia indica erro por linha quando falta equipe; a gravação também revalida a condição na transação. Não foi adicionada integração com ClickUp.

Na listagem de projetos, a coluna Equipe mostra quantas participações de colaboradores ativos estão vigentes **hoje**, ou **Sem equipe vigente**. Esse resumo é diferente da validação de um lançamento retroativo, que usa a data das horas.

## Preparação e validação

Não há nova migração nem necessidade de recriar dados para esta funcionalidade. Os estados e contratos da entrega anterior devem estar presentes na base de integração.

Os testes incluem criação sem equipe, vários integrantes, duplicação, membro inativo, falha no vínculo com rollback, preservação da equipe na edição, bloqueio antes da entrada/depois da saída, correção histórica e os fluxos de horas/Excel. As integrações usam schemas temporários isolados da base da interface.
