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
- Configuração financeira vigente por colaborador, com faixa de remuneração, benefícios e histórico.
- Cadastro, edição, consulta e inativação de projetos.
- Vinculação de colaboradores aos projetos, com papel/função e período de participação.
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
Nodemailer
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
| `clientes` | Empresas ou contratantes atendidos |
| `colaboradores` | Profissionais internos ou alocados |
| `itens_tabela_remuneracao` | Faixas de remuneração e bonificação |
| `configuracoes_financeiras` | Configuração financeira vigente por colaborador |
| `projetos` | Projetos contratados por cliente |
| `projetos_colaboradores` | Relação entre projeto, colaborador, papel e período |

Regras importantes:

- Registros principais são inativados por `status`, sem exclusão física.
- A bonificação pertence à faixa de remuneração, não ao cadastro principal do colaborador.
- O colaborador recebe a regra financeira ao ser vinculado a uma faixa em `configuracoes_financeiras`.
- Ao aplicar uma nova configuração financeira, a configuração vigente anterior é encerrada com `dataFim`.
- A equipe do projeto preserva histórico: encerrar uma participação preenche `dataSaida`.
- Um colaborador não pode ficar ativo duas vezes no mesmo projeto ao mesmo tempo.
- Colaboradores inativos não podem ser vinculados a novos projetos.
- Projetos inativos ficam disponíveis para consulta, mas não permitem alterações na equipe.

---

### Clientes como empresas e consulta de CNPJ

O cadastro de clientes reúne CNPJ, razão social, nome fantasia, pessoa de contato, e-mail, telefone, endereço e informações cadastrais. **Consultar CNPJ** preenche os dados pela ReceitaWS; confira e ajuste antes de salvar. A consulta não salva automaticamente. Se o serviço estiver indisponível ou atingir seu limite, os dados podem ser preenchidos manualmente.

Novos clientes exigem CNPJ válido e único. Clientes antigos continuam disponíveis, com os novos campos vazios até serem atualizados. O status ativo/inativo no sistema é independente da situação cadastral retornada pela ReceitaWS. CNPJs numéricos e alfanuméricos são aceitos na validação e no cadastro; a consulta depende da disponibilidade do documento no provedor.

A integração reutiliza `https://receitaws.com.br/v1/cnpj/{cnpj}` do GiveHope, com consulta pelo backend em `GET /api/clientes/cnpj/:cnpj` (autenticada após integrar a branch `feature/login`), timeout de 12 segundos e cache local de 10 minutos. A API pública da ReceitaWS não exige chave e permite até 3 consultas por minuto. Referência: https://developers.receitaws.com.br/.

Depois de atualizar esta versão, aplique a migration e gere o cliente Prisma na pasta `backend`:

```powershell
corepack pnpm exec prisma migrate deploy
corepack pnpm run prisma:generate
```

## Configuração Financeira do Colaborador

A tabela de remuneração define as faixas financeiras do sistema:

```txt
Nível/Faixa
Valor hora
Bonificação
Tipo de bonificação
Status
```

O colaborador não recebe a bonificação diretamente no cadastro principal. Ele é vinculado a uma faixa por meio da configuração financeira:

```txt
Colaborador
Faixa de remuneração
Benefícios
Data de início
Data de fim
```

Essa estrutura preserva histórico. Quando uma nova configuração financeira é aplicada para o colaborador, a configuração vigente anterior é encerrada e a nova passa a ser usada como referência.

---

## Papéis de Projeto

Os papéis disponíveis para vincular colaboradores aos projetos são retornados pela API em:

```txt
GET /api/projetos/papeis
```

Lista atual:

```txt
Product Owner
Scrum Master
Gerente de Projeto
Tech Lead
Líder Técnico
Arquiteto de Software
Analista de Sistemas
Analista de Negócios
Analista de Produto
Desenvolvedor Full Stack
Desenvolvedor Back-end
Desenvolvedor Front-end
Desenvolvedor Mobile
Programador
QA
UI/UX Designer
DevOps
Engenheiro de Dados
DBA
Especialista em Segurança
Suporte Técnico
```

---

## Endpoints

Base URL:

```txt
http://localhost:3333/api
```

Clientes:

```txt
GET    /clientes
POST   /clientes
GET    /clientes/:id
PUT    /clientes/:id
DELETE /clientes/:id
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
```

Equipe do projeto:

```txt
GET    /projetos/papeis
GET    /projetos/:id/equipe
POST   /projetos/:id/equipe
PUT    /projetos/:id/equipe/:vinculoId
DELETE /projetos/:id/equipe/:vinculoId
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

---

## Variáveis de Ambiente

Back-end:

```txt
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sistema_indicadores"
PORT=3333
JWT_SECRET="dev-secret"
JWT_EXPIRATION="1d"
SMTP_HOST=""
SMTP_USER=""
SMTP_PASS=""
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
```

Front-end:

```powershell
corepack pnpm run dev
corepack pnpm run build
corepack pnpm run preview
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

Recomendações:

- Trabalhar em branches `feature/...`.
- Integrar alterações por Pull Request.
- Manter `main` apenas com versões estáveis.
- Rodar migrations, API e build do front-end antes de integrar alterações.
- Não editar migrations já compartilhadas com o time.

Padrão sugerido de commits:

```txt
feat: nova funcionalidade
fix: correção de erro
docs: documentação
style: ajuste visual
refactor: reorganização interna
chore: configuração ou manutenção
```
