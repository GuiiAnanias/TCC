# Exclusão condicionada de projetos

A ação **Excluir definitivamente**, na lista de projetos, serve somente para remover cadastros sem vínculos nem histórico. Ela é separada da ação de desativar/encerrar, que continua preservando o projeto.

O modal consulta os vínculos antes de habilitar a confirmação. Mostra o nome do projeto e avisa que a exclusão é permanente. Cancelar ou pressionar Esc fecha a confirmação sem enviar a exclusão. Enquanto a gravação ocorre, a confirmação e o fechamento ficam bloqueados para evitar solicitações duplicadas.

## Restrições e API

Qualquer participação de equipe, tarefa, sprint, apontamento ou referência em avaliação de premiação impede a exclusão. Entradas futuras, participações encerradas, tarefas/sprints arquivadas e avaliações em rascunho também contam. O estado do projeto não dispensa essas restrições.

- `GET /api/projetos/:id/exclusao`: retorna `id`, `nome`, `podeExcluir` e as contagens em `vinculos`.
- `DELETE /api/projetos/:id/permanente`: revalida os vínculos na transação e retorna 204 somente quando remove o projeto. Retorna 409 quando há histórico/conflito e 404 quando o projeto não existe.
- `DELETE /api/projetos/:id`: mantém sua finalidade existente de desativar/encerrar; não passa a apagar registros.

As duas novas rotas exigem autenticação, com a política de acesso já existente para cadastros. A confirmação na interface não substitui a validação da API. Um vínculo criado depois da consulta inicial bloqueia a exclusão na gravação. Não existe exclusão em massa nem remoção em cascata dos vínculos.

## Referências de premiação e migração

Aplicar as migrações e gerar o Prisma Client antes de iniciar a versão atualizada:

```sh
pnpm exec prisma migrate deploy
pnpm run prisma:generate
```

A migração `20261107010000_referencias_projetos_avaliacoes` cria `projetos_avaliacoes`, com chaves estrangeiras restritivas. Ela extrai as referências dos campos `conteudo.dados.projetoIds` e `conteudo.base.projetos` das avaliações existentes, sem alterar suas fotografias. Uma referência a projeto inexistente interrompe a migração; deve ser investigada, sem apagar avaliações para contornar a restrição.

Um trigger registra as referências de novas avaliações e alterações de rascunho, inclusive escritas diretas no banco. Referências já registradas permanecem: trocar os projetos de um rascunho não libera para exclusão um projeto que já foi utilizado. As chaves estrangeiras impedem que uma avaliação e uma exclusão concorrentes confirmem deixando uma referência órfã.

Esta entrega não cria histórico persistido de relatórios. Os relatórios Excel atuais são consultas/exportações sem registro persistido de geração. Quando esse histórico for implementado, suas referências aos projetos também deverão ser protegidas por chaves estrangeiras antes de disponibilizar a funcionalidade.

## Validação

`pnpm run test:project-deletion-db` utiliza apenas PostgreSQL local e um schema temporário. Testa migração com avaliações preexistentes, preservação dos conteúdos, referências por tipo, participação encerrada, tarefa/sprint arquivada, exclusão de cadastro vazio, consulta desatualizada, autenticação, desativação existente e concorrência com criação de vínculos/avaliações. O schema é removido ao terminar; a base da interface permanece preservada.
