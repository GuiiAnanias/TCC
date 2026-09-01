# Sistema de Indicadores

Trabalho de Conclusão de Curso — Tecnólogo em Sistemas para Internet
UniALFA Umuarama / Paraná — 2026

Sistema web para gestão de projetos e acompanhamento de indicadores. Centraliza os dados de projetos, colaboradores e custos, calcula indicadores de desempenho e gera relatórios, substituindo o processo atual de exportação manual de dados para planilhas.

**Integrantes**

```txt
Arthur Soares Gardim — 14526
Guilherme Ananias Calixto Ribeiro — 14652
Kaiki Teles de Andrade — 14518
```

---

## Sumário

- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Modelo de dados](#modelo-de-dados)
- [Escopo por fase](#escopo-por-fase)
- [Como rodar](#como-rodar)
- [Roteiro de demonstração](#roteiro-de-demonstração)
- [Fluxo Git](#fluxo-git)
- [Divisão do time](#divisão-do-time)
- [Cronograma](#cronograma)

---

## Arquitetura

```
              ┌─────────────────┐
              │    Front-end    │
              │  React + Vite   │
              └────────┬────────┘
                       │ HTTP + JWT
                       ▼
         ┌─────────────────────────┐
         │    Node + Express       │
         │  ┌───────────────────┐  │
         │  │  http/routes      │  │  adaptador REST
         │  ├───────────────────┤  │
         │  │  services         │  │  regra de negócio
         │  ├───────────────────┤  │
         │  │  repositories     │  │  Prisma Client
         │  └───────────────────┘  │
         │  ┌───────────────────┐  │
         │  │  graphql (fase 2) │  │  adaptador alternativo
         │  └───────────────────┘  │
         └────────────┬────────────┘
                      ▼
              ┌───────────────┐
              │  PostgreSQL   │
              └───────────────┘
```

A camada `services` concentra toda a regra de negócio e **não conhece HTTP**. Ela recebe dados, aplica as regras e devolve dados.

Essa separação é intencional: na fase 2, os módulos de relatórios e filtros analíticos recebem uma interface GraphQL, implementada como um segundo adaptador que chama exatamente os mesmos services. Nenhuma regra de negócio é reescrita.

---

## Stack

**Front-end**

```txt
React
Vite
React Router
Axios
Recharts
```

**Back-end**

```txt
Node.js
Express
Prisma ORM
JWT
bcrypt
Zod
Nodemailer
```

**Banco de dados**

```txt
PostgreSQL
```

**Ferramentas**

```txt
Postman — teste e documentação da API
Prisma Studio — inspeção dos dados
Git / GitHub — versionamento
Trello — gestão das tarefas
```

---

## Estrutura de pastas

```txt
sistema-indicadores/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # modelagem do banco
│   │   ├── migrations/
│   │   └── seed.js
│   ├── src/
│   │   ├── server.js
│   │   ├── config/           # env, conexão, constantes
│   │   ├── http/
│   │   │   ├── routes/       # definição das rotas REST
│   │   │   ├── controllers/  # adaptador fino: req/res
│   │   │   └── middlewares/  # auth, validação, erros
│   │   ├── services/         # REGRA DE NEGÓCIO (sem HTTP)
│   │   ├── repositories/     # acesso ao Prisma
│   │   ├── schemas/          # validação Zod
│   │   ├── utils/
│   │   └── graphql/          # FASE 2
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── api/              # cliente Axios + interceptor JWT
│   │   ├── contexts/         # AuthContext
│   │   ├── routes/           # rotas e proteção
│   │   ├── pages/            # telas
│   │   ├── components/       # componentes reutilizáveis
│   │   └── hooks/
│   └── package.json
├── docs/
│   ├── documentacao-tcc.pdf
│   └── postman/              # collections exportadas
└── README.md
```

---

## Modelo de dados

| Tabela | Descrição | Campos principais |
|---|---|---|
| `usuarios` | Contas de acesso ao sistema | id, nomeUsuario, senhaHash, resetToken, status |
| `clientes` | Clientes contratantes | id, nome, status |
| `projetos` | Projetos da empresa | id, clienteId, nome, tipoContrato, horasContratadas, valorProjeto, dataInicio, status |
| `colaboradores` | Profissionais cadastrados | id, nomeCompleto, email, cargo, departamento, status |
| `projetos_colaboradores` | Equipe vinculada ao projeto | id, projetoId, colaboradorId, papel, dataEntrada, dataSaida |
| `itens_tabela_remuneracao` | Níveis de remuneração e bonificação | id, nivel, valorHora, bonificacao, tipoBonificacao, status |
| `configuracoes_financeiras` | Configuração financeira vigente do colaborador | id, colaboradorId, itemTabelaId, beneficios, dataInicio, dataFim |

**Duas decisões de modelagem que precisam ser respeitadas por todos:**

`configuracoes_financeiras` usa **vigência temporal**. Editar os dados financeiros de um colaborador nunca faz `UPDATE` — fecha a linha atual preenchendo `dataFim` e insere uma nova. O custo de uma tarefa é calculado buscando a configuração vigente na data daquela tarefa. Isso atende a regra de negócio que exige preservar histórico e não recalcular registros já consolidados.

Nenhum registro é excluído fisicamente. Inativação é lógica, pelo campo `status`. Remover um colaborador da equipe preenche `dataSaida`, não deleta a linha.

---

## Escopo por fase

**Fase 1 — MVP (pré-banca, 14/09)**

```txt
Autenticação e recuperação de senha
CRUD de itens da tabela de remuneração e bonificação
CRUD de colaboradores e configuração financeira
CRUD de clientes e projetos
Vinculação de equipe ao projeto com papel e período
```

**Fase 2 — out/nov**

```txt
Cálculo de custo real e indicadores
Dashboard geral, por projeto e por colaborador
Filtros e consultas analíticas
Importação de dados do ClickUp
Geração e exportação de relatórios (PDF e XLSX)
Interface GraphQL para relatórios e filtros
```

---

## Como rodar

### Pré-requisitos

```txt
Node.js 20+
PostgreSQL 15+
Banco: sistema_indicadores
```

### 1. Back-end

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

API disponível em:

```txt
http://localhost:3333
```

Variáveis de ambiente necessárias no `.env`:

```txt
DATABASE_URL="postgresql://usuario:senha@localhost:5432/sistema_indicadores"
JWT_SECRET
JWT_EXPIRATION
SMTP_HOST
SMTP_USER
SMTP_PASS
```

Em desenvolvimento, o envio de e-mail de recuperação de senha usa Ethereal (caixa de entrada de teste, sem configuração).

### 2. Front-end

```bash
cd frontend
npm install
npm run dev
```

Aplicação disponível em:

```txt
http://localhost:5173
```

### 3. Inspecionar o banco

```bash
cd backend
npx prisma studio
```

---

## Roteiro de demonstração

```txt
1. Fazer login no sistema.
2. Cadastrar itens da tabela de remuneração e bonificação.
3. Cadastrar um colaborador e configurar seus dados financeiros.
4. Alterar a configuração financeira e mostrar que o histórico foi preservado.
5. Cadastrar um cliente e um projeto.
6. Vincular colaboradores ao projeto definindo os papéis.
7. Remover um colaborador da equipe e mostrar o registro histórico.
8. Consultar, editar e inativar registros nas listagens.
9. Mostrar a collection do Postman com as rotas testadas.
```

---

## Fluxo Git

```txt
feature/... → develop → main
```

- `main` — apenas versão estável, pronta para apresentação. Ninguém trabalha direto nela.
- `develop` — integração do time. Tudo chega aqui por Pull Request.
- `feature/...` — branch individual de cada integrante.

### Rotina de trabalho

```bash
git checkout develop
git pull origin develop

git checkout nome-da-sua-branch
git merge develop

git status
git add .
git commit -m "feat: descricao da alteracao"
git push
```

### Padrão de commits

```txt
feat:     nova funcionalidade
fix:      correção de erro
style:    alteração visual
docs:     documentação
refactor: reorganização de código
chore:    configuração
```

Exemplos:

```bash
git commit -m "feat(colaborador): cria endpoint de cadastro"
git commit -m "feat(financeiro): implementa vigencia da configuracao"
git commit -m "fix(auth): corrige validacao do token de reset"
git commit -m "docs: adiciona modelo de dados no readme"
```

### Migrations do Prisma

O `schema.prisma` é compartilhado pelos três. Antes de alterar o schema, avise o time. Depois de dar `git pull` com uma migration nova:

```bash
npx prisma migrate dev
npx prisma generate
```

Nunca edite uma migration que já foi enviada para a `develop`.

### Checklist antes do Pull Request para a develop

```txt
[ ] Atualizei minha branch com a develop
[ ] Rodei as migrations pendentes
[ ] Testei minhas rotas no Postman
[ ] Fiz commits com mensagens claras
[ ] O Pull Request está indo para a develop
```

### Checklist antes de enviar para a main

```txt
[ ] A develop está rodando
[ ] O back-end sobe sem erro
[ ] As migrations aplicam em banco limpo
[ ] O front-end não quebrou por alterações da API
[ ] O fluxo da apresentação foi testado do início ao fim
```

### Regras

```txt
Ninguém faz push direto na main
Cada integrante trabalha na sua própria branch
Toda entrega passa por Pull Request para a develop
A main só é atualizada quando a develop está funcionando
Funcionalidade quebrada não vai para a main
```

---

## Divisão do time

| Branch | Responsabilidades |
|---|---|
| `feature/auth-remuneracao` | Setup do repositório, arquitetura base, Prisma, JWT, bcrypt, login, recuperação de senha por token, CRUD da tabela de remuneração e bonificação |
| `feature/colaborador-financeiro` | CRUD de colaboradores, inativação lógica, configuração financeira com vigência temporal, validação de e-mail único |
| `feature/projeto-equipe` | CRUD de clientes, CRUD de projetos, vinculação de equipe ao projeto com papel e período, histórico de alterações de equipe |

### Ordem de dependência

```txt
tabela de remuneração → colaborador → configuração financeira
cliente → projeto → vínculo de equipe
```

O setup base (Prisma, autenticação, cliente HTTP do front) precisa estar na `develop` antes dos outros dois começarem, ou o time trava.

### Criação das branches

```bash
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop
```

```bash
git checkout develop
git checkout -b feature/auth-remuneracao
git push -u origin feature/auth-remuneracao
```

Repetir para as demais branches, trocando o nome.

---

## Cronograma

| Data | Entrega |
|---|---|
| 05/09 | 1ª orientação |
| 11/09 | Especificação do MVP |
| 14/09 e 21/09 | Apresentação para avaliação (pré-banca) dos CRUDs |
| 28/09 a 02/10 | 2ª orientação |
| 30/10 a 06/11 | 3ª orientação |
| 13/11 | Entrega do relatório do projeto de TCC |
| 23 a 25/11 | Banca examinadora |

---

## Documentação

```txt
docs/documentacao-tcc.pdf — user stories, critérios de aceite, regras de negócio,
                            testes de aceitação, wireframes e requisitos não funcionais
docs/postman/              — collections exportadas do Postman
```

Gestão de tarefas no Trello.
