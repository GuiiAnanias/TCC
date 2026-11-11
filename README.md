# Sistema de Indicadores

## Guia rápido para rodar o projeto

Use os comandos abaixo no PowerShell, a partir da pasta raiz do projeto.

### 1. Habilitar o gerenciador de pacotes

```powershell
corepack enable
```

> Se o comando `pnpm` não for reconhecido no terminal, use sempre `corepack pnpm`, como nos exemplos abaixo.

### 2. Subir o banco PostgreSQL

Abra o Docker Desktop e execute:

```powershell
docker compose up -d postgres
```

### 3. Configurar e rodar o back-end

```powershell
cd backend
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm run prisma:generate
corepack pnpm run prisma:migrate
corepack pnpm run seed
corepack pnpm run dev
```

A API ficará disponível em:

```txt
http://localhost:3333
http://localhost:3333/api/health
```

### 4. Configurar e rodar o front-end

Em outro terminal:

```powershell
cd frontend
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm run dev
```

Abra o sistema no navegador:

```txt
http://localhost:5173
```

### Login e proteção de acesso

Após executar o seed, use usuário `admin` (ou e-mail `admin@sistema.local`) e senha `admin123`. Executar o seed novamente não redefine uma conta existente.

As páginas internas exigem login, inclusive ao abrir o endereço diretamente. A sessão é validada pela API antes de exibir o sistema e permanece na mesma aba durante recargas, até expirar ou clicar em **Sair**. Não há tela de cadastro de usuários: as contas vêm do seed. Sessões, limites de tentativas e regras de senha estão em [docs/seguranca.md](docs/seguranca.md).

Configure `JWT_SECRET` no `.env` do backend. Para usar a API ou o Postman, envie `POST /api/auth/login` com `{ "login": "admin", "senha": "admin123" }` e use o `token` retornado em `Authorization: Bearer <token>`. `GET /api/auth/me` consulta a conta autenticada. Todas as rotas de negócio, incluindo opções de cadastro, exigem token válido de uma conta ativa; `/api/health` é público.

Para testar a autenticação e a proteção da API com banco simulado, execute `corepack pnpm test` na pasta `backend`.

#### Esqueci minha senha

Na tela de login, **Esqueci minha senha** abre a tela em que o usuário informa o e-mail da conta. A resposta é sempre a mesma ("Caso o e-mail informado esteja cadastrado, será enviado um link de redefinição de senha."), e o link chega por e-mail apenas se o e-mail pertencer a uma conta ativa.

Em desenvolvimento e na demonstração, os e-mails vão para o **Mailpit**, que sobe junto do banco com `docker compose up -d` e mostra as mensagens em [http://localhost:8025](http://localhost:8025). Nada é enviado para a internet. Para usar um servidor de e-mail real, ajuste `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` e `MAIL_FROM` no `.env` do backend.

Quem administra o servidor também pode gerar o link manualmente na pasta `backend`, informando o usuário ou o e-mail:

```powershell
corepack pnpm run senha:link admin
```

O comando imprime um link para a tela `/redefinir-senha`, válido por 30 minutos e de uso único. O endereço do front vem de `FRONTEND_URL` no `.env` (padrão `http://localhost:5173`). Só o hash do token fica salvo em `usuarios.resetToken`, e gerar um novo link invalida o anterior.

### 5. Abrir o banco em interface visual

Em outro terminal, com o banco e o back-end configurados:

```powershell
cd backend
corepack pnpm run prisma:studio
```

Abra o Prisma Studio no navegador:

```txt
http://localhost:5555
```

### Solução rápida de problemas

```txt
Para parar back-end ou front-end: Ctrl + C no terminal correspondente.
Se o front abrir em branco: confira se o Vite está rodando e pressione Ctrl + F5 no navegador.
Se aparecer "Banco de dados indisponível": confira se o Docker Desktop está aberto e se o container postgres está rodando.
Se a API responder "Rota não encontrada" em http://localhost:3333: acesse as rotas com /api, por exemplo /api/clientes.
```

---

## Visão Geral

O Sistema de Indicadores é uma aplicação web para centralizar a gestão operacional de clientes, colaboradores, projetos, equipes e tabelas de remuneração. A base foi estruturada para preservar histórico, reduzir planilhas manuais e preparar o sistema para indicadores financeiros e operacionais.

Funcionalidades disponíveis:

- Cadastro, edição, consulta e inativação de clientes.
- Cadastro, edição, consulta e inativação de colaboradores.
- Cadastro, edição, consulta e inativação de itens de remuneração.
- Configuração financeira vigente por colaborador, com faixa de remuneração, benefícios informativos (fora do cálculo de custo) e histórico.
- Cadastro, edição, consulta e inativação de projetos.
- Vinculação de colaboradores aos projetos, com papel/função e período de participação.
- Filtros combináveis nos dashboards (período, cliente, vários projetos, colaborador, sprint, equipe e status do projeto), descritos em `docs/filtros.md`.
- Relatórios com prévia: escolha de projetos ou clientes, período e blocos, com uma cópia gravada dos dados de cada geração, download em PDF e Excel e histórico paginado dos relatórios gerados, descritos em `docs/relatorios.md`.
- Exportação dos indicadores do dashboard em Excel (.xlsx), no recorte dos filtros e pronta para o Power BI.
- Importação de apontamentos de horas por planilha Excel, conferida linha a linha antes de gravar.
- Consulta visual dos dados do banco pelo Prisma Studio.
- Collection do Postman para testes da API.

---

## Arquitetura

```txt
Front-end React + Vite
        |
        | HTTP / JSON
        v
Back-end Node.js + Express
        |
        | Prisma Client
        v
PostgreSQL
```

No back-end, a aplicação está separada em camadas:

```txt
routes       -> definição das rotas REST
controllers  -> entrada HTTP: request, response e validação inicial
services     -> regras de negócio
repositories -> acesso ao banco via Prisma
schemas      -> validação dos dados com Zod
```

Essa separação facilita manutenção, testes, troca de interface e evolução do produto sem espalhar regra de negócio pela aplicação inteira.

---

## Documentação dos módulos

As regras de cada módulo ficam na pasta `docs/`:

| Documento | Conteúdo |
|---|---|
| [docs/clientes.md](docs/clientes.md) | Clientes PF/PJ, validações e consultas de CNPJ e CEP |
| [docs/projetos.md](docs/projetos.md) | Tipos de contrato e estados dos projetos |
| [docs/equipe-projetos.md](docs/equipe-projetos.md) | Equipe inicial e quando as horas ficam liberadas |
| [docs/exclusao-projetos.md](docs/exclusao-projetos.md) | Exclusão definitiva condicionada |
| [docs/tarefas-sprints.md](docs/tarefas-sprints.md) | Tarefas e sprints manuais |
| [docs/apontamentos.md](docs/apontamentos.md) | Apontamentos de horas e regras de faturamento |
| [docs/composicao-financeira.md](docs/composicao-financeira.md) | Remuneração, vigências, papéis, bonificação e custo |
| [docs/indicadores.md](docs/indicadores.md) | Fórmulas dos indicadores e da auditoria |
| [docs/filtros.md](docs/filtros.md) | Filtros dos dashboards e da exportação |
| [docs/dashboards.md](docs/dashboards.md) | Visões dos dashboards, ranking de inconsistências, resumo por equipe e evolução do projeto |
| [docs/premiacao.md](docs/premiacao.md) | Avaliação de premiação Dev e PO/SM |
| [docs/seguranca.md](docs/seguranca.md) | Login, sessões, limites e proteção dos dados |
| [docs/login.md](docs/login.md) | Lembrar usuário e recuperação de senha |
| [docs/interface.md](docs/interface.md) | Menu, telas e elementos comuns |

---

## Stack

Front-end:

```txt
React
Vite
React Router
Axios
Lucide React
Recharts
```

Back-end:

```txt
Node.js
Express
Prisma ORM
Zod
JWT
bcrypt
```

Banco e ferramentas:

```txt
PostgreSQL
Docker
Prisma Studio
Postman
pnpm
Corepack
```

---

## Estrutura de Pastas

```txt
sistema-indicadores/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   ├── http/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── config/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── docs/
│   └── postman/
├── docker-compose.yml
└── README.md
```

---

## Modelo de Dados

| Tabela | Descrição |
|---|---|
| `usuarios` | Contas de acesso e recuperação de senha |
| `sessoes` | Sessões de login, com expiração e revogação |
| `limites_autenticacao` | Contadores do limite de tentativas de acesso |
| `clientes` | Clientes pessoa física ou jurídica |
| `colaboradores` | Profissionais internos ou alocados |
| `itens_tabela_remuneracao` | Faixas de remuneração e valor/hora |
| `configuracoes_financeiras` | Vigências de valor/hora e benefícios por colaborador |
| `bonificacoes_papeis` | Percentual de bonificação por papel, com vigência |
| `projetos` | Projetos contratados por cliente |
| `projetos_colaboradores` | Relação entre projeto, colaborador, papel e período |
| `sprints` | Sprints de cada projeto |
| `tarefas` | Tarefas de cada projeto, com estimativa e status |
| `tarefas_responsaveis` | Responsáveis de cada tarefa |
| `apontamentos_horas` | Horas trabalhadas, com status e composição do custo faturado |
| `regras_premiacao` | Versões publicadas das regras de premiação |
| `avaliacoes_premiacao` | Avaliações mensais de premiação e suas versões |
| `projetos_avaliacoes` | Projetos usados em cada avaliação |

Regras importantes:

- Clientes, colaboradores e itens de remuneração são inativados por `status`, sem exclusão física. Projetos são encerrados; a exclusão definitiva vale só para projetos sem vínculos. Apontamentos não faturados podem ser excluídos.
- A bonificação usada nos custos é definida por papel no projeto e por vigência, separadamente da faixa de remuneração.
- O colaborador recebe a regra financeira ao ser vinculado a uma faixa em `configuracoes_financeiras`.
- Ao aplicar uma nova configuração financeira, a configuração vigente anterior é encerrada com `dataFim`.
- A equipe do projeto preserva histórico: encerrar uma participação preenche `dataSaida`.
- Um colaborador não pode ficar ativo duas vezes no mesmo projeto ao mesmo tempo.
- Colaboradores inativos não podem ser vinculados a novos projetos.
- Projetos pausados, encerrados ou cancelados ficam disponíveis para consulta, mas não permitem alterações na equipe.
- Apontamentos com status FATURADO não podem ser editados nem excluídos, porque as horas já foram cobradas do cliente. Para corrigir, volte o status para APROVADO, salve e depois edite.

---

### Clientes PF e PJ

O cadastro de clientes aceita pessoa jurídica (CNPJ) e pessoa física (CPF). **Consultar CNPJ** preenche os dados pela ReceitaWS, e digitar o CEP preenche o endereço pela ViaCEP. As consultas não salvam nada; se o serviço estiver indisponível ou atingir seu limite, os dados podem ser preenchidos manualmente. O status ativo/inativo no sistema é independente da situação cadastral da ReceitaWS. Validações, limites das consultas e API estão em [docs/clientes.md](docs/clientes.md).

## Configuração Financeira do Colaborador

A tabela de remuneração define as faixas financeiras do sistema:

```txt
Nível/Faixa
Valor hora
Status
```

A bonificação usada nos custos não fica na faixa: ela é definida por papel no projeto, com vigência. As colunas `bonificacao` e `tipoBonificacao` de `itens_tabela_remuneracao` são legadas: continuam no banco, mas não aparecem na tela, não são aceitas pela API e não entram no custo.

O colaborador é vinculado a uma faixa por meio da configuração financeira:

```txt
Colaborador
Faixa de remuneração
Benefícios (informativo, não entra no custo)
Data de início
Data de fim
```

Essa estrutura preserva histórico. Quando uma nova configuração financeira é aplicada para o colaborador, a configuração vigente anterior é encerrada e a nova passa a ser usada como referência.

As regras de datas, as travas do histórico, a bonificação por papel e a fórmula do custo estão em [docs/composicao-financeira.md](docs/composicao-financeira.md).

---

## Papéis de Projeto

Os papéis disponíveis para vincular colaboradores aos projetos são retornados pela API em:

```txt
GET /api/projetos/papeis
```

Lista atual:

```txt
Dev
Product Owner
Scrum Master
Tech Lead
Líder Técnico
QA
UI/UX Designer
DevOps
Gerente de Projeto
Arquiteto de Software
Analista de Sistemas
Analista de Negócios
Analista de Produto
Desenvolvedor Full Stack
Desenvolvedor Back-end
Desenvolvedor Front-end
Desenvolvedor Mobile
Programador
Engenheiro de Dados
DBA
Especialista em Segurança
Suporte Técnico
```

O papel no projeto é independente do cargo do colaborador e define a bonificação aplicada às horas.

---

## Endpoints

Base URL:

```txt
http://localhost:3333/api
```

Exceto `/health`, `/auth/login`, `/auth/esqueci-senha`, `/auth/redefinir-senha/validar` e `/auth/redefinir-senha`, todas as rotas exigem `Authorization: Bearer <token>`. Os documentos em `docs/` detalham parâmetros e regras de cada módulo.

Autenticação:

```txt
POST   /auth/login
GET    /auth/me
POST   /auth/logout
POST   /auth/esqueci-senha
POST   /auth/redefinir-senha/validar
POST   /auth/redefinir-senha
```

Opções e dashboards:

```txt
GET    /opcoes-cadastro
GET    /dashboard
GET    /dashboard/opcoes
GET    /dashboard/projetos/:id
GET    /dashboard/colaboradores/:id
```

Clientes:

```txt
GET    /clientes
POST   /clientes
GET    /clientes/:id
PUT    /clientes/:id
DELETE /clientes/:id
GET    /clientes/cnpj/:cnpj
GET    /clientes/cep/:cep
```

Colaboradores:

```txt
GET    /colaboradores
POST   /colaboradores
GET    /colaboradores/:id
PUT    /colaboradores/:id
DELETE /colaboradores/:id

GET    /colaboradores/:id/configuracoes-financeiras
POST   /colaboradores/:id/configuracoes-financeiras
PUT    /colaboradores/:id/configuracoes-financeiras/:configuracaoId
DELETE /colaboradores/:id/configuracoes-financeiras/:configuracaoId
```

Remuneração:

```txt
GET    /remuneracoes
POST   /remuneracoes
GET    /remuneracoes/:id
PUT    /remuneracoes/:id
DELETE /remuneracoes/:id
```

Projetos:

```txt
GET    /projetos
POST   /projetos
GET    /projetos/:id
PUT    /projetos/:id
DELETE /projetos/:id
GET    /projetos/:id/exclusao
DELETE /projetos/:id/permanente
```

Equipe do projeto:

```txt
GET    /projetos/papeis
GET    /projetos/:id/equipe
POST   /projetos/:id/equipe
PUT    /projetos/:id/equipe/:vinculoId
DELETE /projetos/:id/equipe/:vinculoId
```

Bonificação por papel:

```txt
GET    /bonificacoes-papeis
POST   /bonificacoes-papeis
```

Apontamentos de horas:

```txt
GET    /apontamentos
POST   /apontamentos
GET    /apontamentos/:id
PUT    /apontamentos/:id
DELETE /apontamentos/:id
```

Tarefas e sprints:

```txt
GET    /tarefas
POST   /tarefas
PUT    /tarefas/:id
GET    /sprints
POST   /sprints
PUT    /sprints/:id
```

Premiação:

```txt
GET    /premiacoes/modelos
GET    /premiacoes/regras
POST   /premiacoes/regras
GET    /premiacoes
POST   /premiacoes
GET    /premiacoes/:id
PUT    /premiacoes/:id
POST   /premiacoes/:id/concluir
```

Exemplo para vincular colaborador a um projeto:

```json
{
  "colaboradorId": 1,
  "papel": "Tech Lead",
  "dataEntrada": "2026-09-04"
}
```

Exemplo para aplicar uma configuração financeira ao colaborador:

```json
{
  "itemTabelaId": 1,
  "beneficios": 500,
  "dataInicio": "2026-09-04"
}
```

Relatórios e importação em Excel:

```txt
GET    /relatorios/indicadores.xlsx          aceita os mesmos filtros de GET /dashboard (docs/filtros.md)
GET    /importacoes/apontamentos/modelo      modelo .xlsx com listas dos cadastros ativos
POST   /importacoes/apontamentos/validacao   corpo = arquivo .xlsx; confere sem gravar
POST   /importacoes/apontamentos             corpo = arquivo .xlsx; grava tudo ou nada
```

---

## Importação e exportação em Excel

**Exportar.** No Dashboard Geral, aplique os filtros e clique em **Exportar Excel**. A planilha
sai com o mesmo recorte da tela, em seis abas:

| Aba           | Conteúdo                                                                          |
| ------------- | --------------------------------------------------------------------------------- |
| Resumo        | Filtros aplicados e os indicadores do topo do dashboard                           |
| Projetos      | Orçamento, custo, horas, assertividade e inconsistências por projeto              |
| Clientes      | Horas e custo por cliente                                                         |
| Colaboradores | Horas e custo por colaborador                                                     |
| Apontamentos  | Uma linha por apontamento, com valor/hora, bonificação e custo (base do Power BI) |
| Ocorrências   | Pendências da auditoria (sem valor/hora, sem equipe, sem tarefa etc.)             |

As abas de dados são Tabelas do Excel, que o Power BI reconhece direto em
_Obter dados > Excel_. A planilha contém custos internos e valor/hora: é para uso interno da
empresa, não para enviar ao cliente.

**Importar.** Em **Importar horas**, baixe o modelo, preencha uma linha por apontamento e
envie o arquivo. O modelo abre na aba **Como usar** (passo a passo curto), marca em vermelho
o que estiver faltando ou errado enquanto você preenche, mostra um resumo ao lado da tabela e
já traz os colaboradores, projetos e tarefas ativos na aba Listas, com a lista de tarefas
filtrada pelo projeto escolhido.

- Colunas: Data, E-mail do colaborador, Projeto, Tarefa (opcional), Horas, Status (opcional) e
  Descrição. Horas aceitam `7,5` ou `07:30`; status em branco entra como Pendente.
- O sistema confere todas as linhas antes de gravar e mostra o erro de cada uma, com o número
  da linha do Excel. Valem as regras do cadastro manual: data até hoje, até 24 h por
  colaborador no dia (somando o que já está gravado) e tarefa ativa do mesmo projeto.
- A importação é tudo ou nada e roda numa transação serializável. Linhas iguais a
  apontamentos já gravados são recusadas, o que evita importar a mesma planilha duas vezes.
- Avisos não bloqueiam: indicam horas que entram com custo incompleto (colaborador fora da
  equipe do projeto na data ou sem valor/hora vigente).
- Limite de 2.000 linhas e 5 MB por arquivo.

---

## Variáveis de Ambiente

Back-end:

```txt
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sistema_indicadores"
PORT=3333
JWT_SECRET="dev-secret"
JWT_EXPIRATION="1d"
FRONTEND_URL="http://localhost:5173"
```

Front-end:

```txt
VITE_API_URL="http://localhost:3333/api"
```

---

## Antes de Compactar o Projeto

Estas pastas e arquivos podem ficar fora do zip:

```txt
backend/node_modules/
frontend/node_modules/
frontend/dist/
backend/.env
frontend/.env
```

Mantenha estes arquivos, porque eles permitem instalar tudo de novo:

```txt
backend/package.json
backend/pnpm-lock.yaml
frontend/package.json
frontend/pnpm-lock.yaml
backend/.env.example
frontend/.env.example
docker-compose.yml
```

Depois de extrair o projeto em outra máquina, os comandos do guia rápido recriam as dependências e os arquivos `.env` locais.

---

## Banco de Dados

O banco padrão do ambiente local roda em PostgreSQL pelo Docker.

Dados do `docker-compose.yml`:

```txt
Host: localhost
Porta: 5432
Banco: sistema_indicadores
Usuário: postgres
Senha: postgres
```

Com esses dados, também é possível conectar por ferramentas como DBeaver, DataGrip ou pgAdmin.

---

## Postman

A collection da API fica em:

```txt
docs/postman/sistema-indicadores.postman_collection.json
```

Ela usa a variável:

```txt
baseUrl = http://localhost:3333/api
```

---

## Scripts Úteis

Back-end:

```powershell
corepack pnpm run dev
corepack pnpm run start
corepack pnpm run prisma:generate
corepack pnpm run prisma:migrate
corepack pnpm run prisma:studio
corepack pnpm run seed
corepack pnpm run senha:link admin
corepack pnpm test
corepack pnpm run format
corepack pnpm run lint
```

Front-end:

```powershell
corepack pnpm run dev
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run format
corepack pnpm run lint
```

---

## Cronograma

| Data | Entrega |
|---|---|
| 05/09 | 1ª orientação |
| 11/09 | Especificação do MVP |
| 14/09 e 21/09 | Apresentação para avaliação dos CRUDs |
| 28/09 a 02/10 | 2ª orientação |
| 30/10 a 06/11 | 3ª orientação |
| 13/11 | Entrega do relatório do projeto de TCC |
| 23 a 25/11 | Banca examinadora |

---

## Fluxo de Versionamento

```txt
feature/... -> develop -> main
```

- `main`: só versões estáveis, prontas para apresentação. Ninguém trabalha direto nela e ela só recebe Pull Request vindo da `develop`.
- `develop`: integração do time. Toda alteração chega aqui por Pull Request.
- `feature/<assunto>`: uma branch por funcionalidade ou correção, criada a partir da `develop` atualizada. Exemplos: `feature/exportacao-xlsx`, `feature/redefinicao-senha`.

No GitHub ficam só `main` e `develop` de forma permanente. A branch `feature/...` é apagada automaticamente quando o Pull Request é mergeado.

Rotina:

```powershell
git switch develop
git pull
git switch -c feature/nome-da-funcionalidade
# commits
git push -u origin feature/nome-da-funcionalidade
```

A `develop` é a branch padrão do GitHub, então o Pull Request já abre com base nela. Confira mesmo assim antes de criar.

Recomendações:

- Rodar migrations, API e build do front-end antes de integrar alterações.
- Não editar migrations já compartilhadas com o time.

### Padrão de código e CI

O código segue o Prettier (formatação) e o ESLint (erros comuns). Antes de commitar, rode na pasta que você alterou (`backend` ou `frontend`):

```powershell
corepack pnpm run format
corepack pnpm run lint
```

O `format` arruma a formatação sozinho. O `lint` lista o que precisa de correção: erro bloqueia, aviso não. No VS Code, a extensão Prettier com "Format On Save" faz o `format` a cada salvamento.

A cada Pull Request e a cada push na `develop` ou na `main`, o GitHub Actions confere a formatação, o lint, os testes, as migrations num banco limpo e o build do front-end. Se algum passo falhar, o PR fica com X vermelho e não deve ser mergeado.

O `.gitattributes` mantém a quebra de linha em LF para todo o time, inclusive no Windows.

Padrão sugerido de commits:

```txt
feat: nova funcionalidade
fix: correção de erro
docs: documentação
style: ajuste visual
refactor: reorganização interna
chore: configuração ou manutenção
```

## Dados de demonstração e conferência dos indicadores

Com o PostgreSQL iniciado e o `.env` configurado, execute na pasta `backend`:

```powershell
corepack pnpm run prisma:migrate
corepack pnpm run prisma:generate
corepack pnpm run seed
```

O seed acrescenta cenários sem apagar dados, redefinir a senha de contas existentes
ou sobrescrever registros já encontrados. Em uma base nova, o acesso inicial é
`admin` / `admin123`. Os cenários usam datas fixas entre setembro e novembro de
2026 e valores financeiros fictícios, sem depender do dia da execução.

Os clientes com CNPJ usam os dados públicos preservados em
`backend/prisma/seed-companies.js`, consultados na ReceitaWS em 17/10/2026:
CAIXA ESCOLAR DA ESCOLA ESTADUAL DE ENSINO FUNDAMENTAL JOSEFINA JACQUES NORONHA
(11.222.333/0001-81) e Z R DE BRITO EMPREITEIRA (11.444.777/0001-61).
O seed utiliza esse snapshot sem consultar a internet. Projetos, pessoas, valores,
horas e vínculos são exemplos fictícios; não representam relações reais dessas empresas.

### Conteúdo inicial

| Cadastro | Quantidade |
| --- | ---: |
| Usuário administrador | 1 |
| Clientes PF/PJ | 4 |
| Colaboradores | 9 |
| Faixas de remuneração | 9 |
| Configurações financeiras | 10 |
| Bonificações por papel e vigência | 5 |
| Projetos | 6 |
| Participações de equipe | 12 |
| Sprints | 7 |
| Tarefas | 17 |
| Associações de responsáveis | 18 |
| Apontamentos de horas | 16 |
| Regras de premiação sem faixas presumidas | 2 |
| Avaliações de premiação | 2 |

Há reajustes financeiros, troca de papel, bônus com vigências, uma configuração
futura, pessoas e projetos inativos, tarefas compartilhadas, correções, tarefas sem
estimativa ou sem horas e um apontamento sem tarefa. As horas de uma tarefa não são
multiplicadas pela quantidade de responsáveis. O seed também inclui os exemplos de premiação descritos abaixo.

### Resultados esperados no Dashboard Geral

Os números abaixo pressupõem uma base inicialmente vazia, sem edições manuais,
e o dashboard sem filtros, incluindo projetos ativos e inativos.

| Projeto | Orçamento | Horas | Custo | Assertividade do orçamento |
| --- | ---: | ---: | ---: | ---: |
| Portal do Cliente (demo) | R$ 2.424,00 | 22 | R$ 1.212,00 | 200% |
| Aplicativo Mobile (demo) | R$ 539,50 | 14 | R$ 1.079,00 | 50% |
| Integração de Dados (demo) | R$ 560,00 | 14 | R$ 560,00 | 100% |
| Projeto com pendências (demo) | R$ 1.000,00 | 15 | R$ 300,00 parcial | Indisponível |
| Projeto em planejamento (demo) | R$ 5.000,00 | 0 | R$ 0,00 | Indisponível |
| Projeto encerrado (demo) | R$ 680,00 | 4 | R$ 340,00 | 200% |

Totais: **69 horas**, **R$ 3.491,00 de custo parcial**, incluindo R$ 281,00 de
bonificação. Há 5 horas sem remuneração e um apontamento sem vínculo de equipe.
A média da assertividade dos quatro projetos elegíveis é 137,5%.
A fórmula por projeto é `orçamento / custo realizado × 100`.

Indicadores operacionais iniciais: correções por horas 23,19%; assertividade das
estimativas 70,91%; tarefas concluídas sem horas 18,18%; tarefas sem estimativa 25%.
A classificação de correções é parcial porque existem horas sem tarefa. As explicações,
bases e motivos de indisponibilidade podem ser consultados no botão de ajuda das telas.

### Alterações manuais para observar os resultados

1. Mude o orçamento do Aplicativo Mobile de R$ 539,50 para R$ 1.079: a assertividade
   passa de 50% para 100%.
2. No apontamento `Demonstração: portal-login-dev`, mude 8h para 10h: o custo do
   Portal sobe R$ 105, para R$ 1.317; sua assertividade passa a 184,05%. Sem outras
   mudanças de custo, o total geral passa a R$ 3.596.
3. Cadastre a primeira configuração financeira de Felipe com início em 01/09/2026,
   usando Júnior III de R$ 45/h: suas 5h passam a custar R$ 247,50 com bônus QA,
   removendo a pendência de remuneração.
4. Vincule Gustavo à equipe do projeto com pendências como Dev, desde 01/09/2026:
   suas 2h passam de R$ 80 para R$ 88 e o aviso de participação desaparece.
5. Edite estimativas, marque correções ou registre horas na tarefa concluída sem
   horas e atualize os indicadores. Os dashboards individuais permitem conferir
   os apontamentos e a composição do resultado.

Editar apenas a tabela de remuneração não altera as taxas preservadas nas configurações
financeiras anteriores. Para testar outro valor/hora, crie uma nova vigência e lance
horas cobertas por ela. A comparação com orçamento integral fica indisponível com
recortes de período, equipe, pessoa ou sprint.

### Reexecução e verificações

O seed mantém edições nos registros que encontra. Tarefas e sprints têm origem `DEMO`
e identificadores estáveis. Clientes usam CNPJ ou e-mail/tipo; colaboradores usam
e-mail; faixas usam nível; projetos usam nome/cliente; participações usam
projeto/pessoa/papel/entrada; apontamentos usam projeto/pessoa/descrição.
Alterar essas chaves pode fazer uma nova execução acrescentar o exemplo original.
O fluxo recomendado é popular uma base limpa e depois experimentar as alterações manualmente.

Na pasta `backend`, os comandos abaixo usam um schema temporário no PostgreSQL local,
aplicam as migrações e removem somente o schema de teste ao terminar:

```powershell
corepack pnpm test
corepack pnpm run test:seed-db
corepack pnpm run test:dashboard-db
corepack pnpm run test:tasks-db
corepack pnpm run test:hours-db
corepack pnpm run test:excel-db
corepack pnpm run test:auth-db
corepack pnpm run test:team-db
corepack pnpm run test:finance-db
corepack pnpm run test:invoiced-costs-db
corepack pnpm run test:project-deletion-db
corepack pnpm run test:awards-db
```

As verificações de integração exigem PostgreSQL local em execução e `DATABASE_URL`
configurada. Elas conferem cenários, preservação de ajustes e reexecução sem duplicatas;
não executam reset no banco utilizado pela interface.

O Docker persiste o banco em um volume: recriar o contêiner ou a imagem não limpa
os dados. O seed também não realiza essa limpeza.

## Avaliação de premiação e exemplos do seed

A tela **Premiação** permite publicar regras e avaliar uma pessoa por competência
mensal e categoria Dev ou PO/SM. A pontuação começa em 10 nos modelos da planilha;
cada critério com ocorrência desconta sua dedução uma vez no período. Ocorrência e
Não aplicável exigem evidência/justificativa. Os indicadores servem para conferência,
sem inferir automaticamente notificações, atrasos ou responsabilidade por erro.

As faixas de nota não estão disponíveis na planilha fornecida e começam vazias.
Configure faixas sem sobreposição ou informe elegibilidade manual com justificativa.
O percentual final é `percentual-base × elegibilidade / 100`: base 5% e elegibilidade
80% resultam em 4%. Não há cálculo em reais nem inclusão automática no custo por papel.
Nota conferida pode ser concluída mesmo com percentual indisponível.

Salvar o rascunho atualiza e preserva a base de tarefas/indicadores do mês e do
contexto selecionado. Concluir bloqueia edições; Reavaliar cria outra versão com
nova conferência, mantendo a anterior no histórico. Regras publicadas também não
são sobrescritas. A ajuda completa fica no “?” junto ao título da página.

API autenticada: `GET /api/premiacoes/modelos`, `GET/POST /api/premiacoes/regras`,
`GET/POST /api/premiacoes`, `GET/PUT /api/premiacoes/:id` e
`POST /api/premiacoes/:id/concluir`. Listagem aceita colaboradorId, competencia
(AAAA-MM), categoria (DEV/PO_SM) e status (RASCUNHO/CONCLUIDA).

Depois de aplicar as migrações, o seed completo inclui os exemplos de avaliação.
Em uma base demo já existente, `node scripts/seed-awards-local.mjs` acrescenta apenas
os exemplos de premiação. Verificação: `corepack pnpm test`, `corepack pnpm run test:awards-db` e
`corepack pnpm run test:seed-db` no backend; `corepack pnpm run build` no frontend.
As integrações criam e removem somente schemas temporários no PostgreSQL local.

Critérios, cálculo e fluxo completos estão em [docs/premiacao.md](docs/premiacao.md).
