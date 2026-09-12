# Guia de Git para a Equipe

Este guia organiza os commits seguindo a divisão de branches da equipe:

```txt
feature/auth-remuneracao
feature/colaborador-financeiro
feature/projeto-equipe
```

A branch `main` deve ficar como versão estável. A branch `develop` será usada para integração. Cada participante trabalha em uma `feature/...`, abre Pull Request para `develop`, e só no final a `develop` vai para `main`.

---

## Antes de Começar

Se esta pasta veio de um zip e não tem histórico Git, o comando abaixo pode mostrar erro:

```powershell
git status
```

Se aparecer `fatal: not a git repository`, o mais seguro é clonar o repositório em uma pasta limpa:

```powershell
cd C:\TCC
git clone https://github.com/GuiiAnanias/TCC.git TCC-Git
cd TCC-Git
```

Depois copie para dentro dessa pasta os arquivos do projeto atual. Assim vocês trabalham com Git de verdade e não apenas com uma pasta zipada.

Se a pasta já for um repositório Git, siga normalmente:

```powershell
cd C:\TCC\TCC
git branch --show-current
git status
```

---

## Fluxo Recomendado

```txt
1. Criar a develop a partir da main.
2. Criar uma branch feature para cada participante.
3. Cada participante commita apenas os arquivos da sua responsabilidade.
4. Cada feature abre Pull Request para develop.
5. Todos atualizam a develop após cada merge.
6. No final, develop abre Pull Request para main.
```

Evite todo mundo extrair o zip completo por cima de um clone e sair dando `git pull`, porque arquivos ainda não rastreados podem conflitar com arquivos que outra pessoa acabou de subir.

---

## Regras Para Não Dar Problema

- Não fazer commit direto na `main`.
- Não dar push direto na `main`.
- Criar `develop` e integrar tudo nela primeiro.
- Cada participante deve trabalhar em uma branch `feature/...`.
- Cada `feature/...` deve virar Pull Request para `develop`.
- Não commitar `.env`, `node_modules` nem `dist`.
- Rodar `git status` antes de cada commit.
- Conferir `git diff --cached --stat` antes de confirmar o commit.

---

## Etapa 0 - Criar a Develop

Esta etapa deve ser feita uma única vez, por quem está com o projeto local completo e já dentro do repositório Git.

```powershell
cd C:\TCC\TCC
git switch main
git pull origin main
git switch -c develop
git push -u origin develop
```

Depois disso, todos devem usar a `develop` como base.

---

## Ordem Recomendada

Como o projeto tem arquivos compartilhados, esta ordem reduz conflito:

```txt
1. feature/auth-remuneracao
2. feature/colaborador-financeiro
3. feature/projeto-equipe
```

Depois que uma pessoa fizer merge na `develop`, as próximas devem atualizar:

```powershell
git switch develop
git pull origin develop
```

---

## Participante 1 - Auth, Remuneração e Base Técnica

Branch:

```txt
feature/auth-remuneracao
```

Responsabilidade:

```txt
Setup do projeto, Docker, Prisma, estrutura base do back-end,
usuários, dependências, validações comuns e CRUD de remuneração.
```

Criar a branch:

```powershell
cd C:\TCC\TCC
git switch develop
git pull origin develop
git switch -c feature/auth-remuneracao
```

Adicionar arquivos:

```powershell
git add docker-compose.yml
git add backend/.env.example
git add backend/package.json
git add backend/pnpm-lock.yaml
git add backend/pnpm-workspace.yaml
git add backend/prisma
git add backend/src/app.js
git add backend/src/server.js
git add backend/src/config
git add backend/src/utils
git add backend/src/http/middlewares
git add backend/src/http/routes/index.js
git add backend/src/http/routes/remuneracoesRoutes.js
git add backend/src/http/controllers/remuneracoesController.js
git add backend/src/repositories/remuneracoesRepository.js
git add backend/src/schemas/commonSchemas.js
git add backend/src/schemas/remuneracoesSchemas.js
git add backend/src/services/remuneracoesService.js
```

Conferir:

```powershell
git status
git diff --cached --stat
```

Commit:

```powershell
git commit -m "feat: implementa base tecnica e remuneracao"
```

Subir branch:

```powershell
git push -u origin feature/auth-remuneracao
```

Abrir Pull Request no GitHub:

```txt
Base: develop
Compare: feature/auth-remuneracao
Título: feat: implementa base tecnica e remuneracao
```

Depois que o PR for aceito:

```powershell
git switch develop
git pull origin develop
```

---

## Participante 2 - Colaborador e Financeiro

Branch:

```txt
feature/colaborador-financeiro
```

Responsabilidade:

```txt
CRUD de colaboradores, validação de e-mail único, inativação lógica
e configuração financeira vigente ligada à tabela de remuneração.
```

Criar a branch depois que a Parte 1 estiver na `develop`:

```powershell
cd C:\TCC\TCC
git switch develop
git pull origin develop
git switch -c feature/colaborador-financeiro
```

Adicionar arquivos:

```powershell
git add backend/src/http/routes/colaboradoresRoutes.js
git add backend/src/http/controllers/colaboradoresController.js
git add backend/src/http/controllers/configuracoesFinanceirasController.js
git add backend/src/repositories/colaboradoresRepository.js
git add backend/src/repositories/configuracoesFinanceirasRepository.js
git add backend/src/schemas/colaboradoresSchemas.js
git add backend/src/schemas/configuracoesFinanceirasSchemas.js
git add backend/src/services/colaboradoresService.js
git add backend/src/services/configuracoesFinanceirasService.js
git add frontend/src/components/CollaboratorFinanceManager.jsx
git add frontend/src/config/resources.jsx
git add frontend/src/pages/CrudPage.jsx
git add frontend/src/styles.css
```

Se a branch ainda não tiver recebido a rota de colaboradores no arquivo compartilhado, adicionar também:

```powershell
git add backend/src/http/routes/index.js
git add backend/src/app.js
```

Conferir:

```powershell
git status
git diff --cached --stat
```

Commit:

```powershell
git commit -m "feat: implementa colaboradores e configuracao financeira"
```

Subir branch:

```powershell
git push -u origin feature/colaborador-financeiro
```

Abrir Pull Request no GitHub:

```txt
Base: develop
Compare: feature/colaborador-financeiro
Título: feat: implementa colaboradores e configuracao financeira
```

Depois que o PR for aceito:

```powershell
git switch develop
git pull origin develop
```

---

## Participante 3 - Projetos, Clientes e Equipe

Branch:

```txt
feature/projeto-equipe
```

Responsabilidade:

```txt
CRUD de clientes, CRUD de projetos, vínculo de colaboradores aos projetos,
papéis da equipe, filtros, interface web e documentação operacional.
```

Criar a branch depois que as Partes 1 e 2 estiverem na `develop`:

```powershell
cd C:\TCC\TCC
git switch develop
git pull origin develop
git switch -c feature/projeto-equipe
```

Adicionar arquivos de clientes e projetos:

```powershell
git add backend/src/http/routes/clientesRoutes.js
git add backend/src/http/routes/projetosRoutes.js
git add backend/src/http/controllers/clientesController.js
git add backend/src/http/controllers/projetosController.js
git add backend/src/repositories/clientesRepository.js
git add backend/src/repositories/projetosRepository.js
git add backend/src/schemas/clientesSchemas.js
git add backend/src/schemas/projetosSchemas.js
git add backend/src/schemas/equipeProjetoSchemas.js
git add backend/src/services/clientesService.js
git add backend/src/services/projetosService.js
git add frontend/src/components/ProjectTeamManager.jsx
```

Adicionar arquivo compartilhado de rotas se ele foi alterado para ligar clientes e projetos:

```powershell
git add backend/src/http/routes/index.js
git add backend/src/app.js
```

Adicionar front-end base, caso ainda não tenha entrado por outra branch:

```powershell
git add frontend/.env.example
git add frontend/index.html
git add frontend/package.json
git add frontend/pnpm-lock.yaml
git add frontend/pnpm-workspace.yaml
git add frontend/src/App.jsx
git add frontend/src/api
git add frontend/src/components/StatusBadge.jsx
git add frontend/src/main.jsx
git add frontend/src/pages/DashboardPage.jsx
git add frontend/src/pages/CrudPage.jsx
git add frontend/src/config
git add frontend/src/styles.css
```

Adicionar documentação:

```powershell
git add README.md
git add GUIA_GIT_EQUIPE.md
git add docs/postman/sistema-indicadores.postman_collection.json
```

Conferir:

```powershell
git status
git diff --cached --stat
```

Commit:

```powershell
git commit -m "feat: implementa projetos, equipe e interface web"
```

Subir branch:

```powershell
git push -u origin feature/projeto-equipe
```

Abrir Pull Request no GitHub:

```txt
Base: develop
Compare: feature/projeto-equipe
Título: feat: implementa projetos, equipe e interface web
```

Depois que o PR for aceito:

```powershell
git switch develop
git pull origin develop
```

---

## Observação Sobre Arquivos Compartilhados

Alguns arquivos são compartilhados por mais de uma parte:

```txt
backend/prisma/schema.prisma
backend/prisma/migrations
backend/src/app.js
backend/src/http/routes/index.js
frontend/src/config/resources.jsx
frontend/src/pages/CrudPage.jsx
frontend/src/styles.css
README.md
docs/postman/sistema-indicadores.postman_collection.json
```

Por isso, a divisão não é perfeitamente isolada por arquivo. O mais importante é seguir a ordem dos PRs e sempre atualizar a `develop` antes de criar a próxima branch.

Se dois participantes mexerem no mesmo arquivo ao mesmo tempo, pode aparecer conflito. Não é o fim do mundo: o Git vai pedir para resolver manualmente antes do merge.

---

## Como os Colegas Devem Receber o Projeto

Forma recomendada:

```powershell
cd C:\TCC
git clone https://github.com/GuiiAnanias/TCC.git TCC
cd TCC
git switch develop
git pull origin develop
```

Se receberem o zip:

```txt
1. Clonar o repositório do GitHub em uma pasta limpa.
2. Entrar na develop.
3. Criar a branch feature da sua responsabilidade.
4. Copiar do zip apenas os arquivos da sua parte.
5. Rodar git add apenas nos arquivos da sua parte.
6. Commitar.
7. Fazer push da branch.
8. Abrir Pull Request para develop.
```

---

## Atualizar Depois Que Alguém Fizer Merge

Sempre que um PR entrar na `develop`:

```powershell
cd C:\TCC\TCC
git switch develop
git pull origin develop
```

Se já estiver em uma branch feature e precisar trazer as novidades:

```powershell
git switch feature/nome-da-sua-branch
git merge develop
```

---

## Conferências Antes do Pull Request

Back-end:

```powershell
cd C:\TCC\TCC
Get-ChildItem backend\src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Front-end:

```powershell
cd C:\TCC\TCC\frontend
corepack pnpm run build
```

API local:

```powershell
cd C:\TCC\TCC
Invoke-RestMethod -Uri http://localhost:3333/api/health
```

---

## Enviar Develop Para Main no Final

Opção recomendada: abrir Pull Request no GitHub:

```txt
Base: main
Compare: develop
Título: release: publica versão inicial do sistema
```

Opção por comando:

```powershell
cd C:\TCC\TCC
git switch main
git pull origin main
git merge --no-ff develop
git push origin main
```

---

## Comandos Úteis de Segurança

Ver branch atual:

```powershell
git branch --show-current
```

Ver arquivos alterados:

```powershell
git status
```

Ver arquivos preparados para commit:

```powershell
git diff --cached --stat
```

Tirar arquivos da área de commit sem apagar alterações:

```powershell
git restore --staged .
```

Guardar alterações temporariamente:

```powershell
git stash push -m "alteracoes temporarias"
```

Trazer alterações guardadas de volta:

```powershell
git stash pop
```

Evite estes comandos se não tiver certeza absoluta:

```powershell
git reset --hard
git clean -fd
```
