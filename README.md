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

As páginas internas exigem login, inclusive ao abrir o endereço diretamente. A sessão é validada pela API antes de exibir o sistema e permanece na mesma aba durante recargas, até expirar ou clicar em **Sair**. Não há cadastro de usuários nesta etapa.

Configure `JWT_SECRET` no `.env` do backend. Para usar a API ou o Postman, envie `POST /api/auth/login` com `{ "login": "admin", "senha": "admin123" }` e use o `token` retornado em `Authorization: Bearer <token>`. `GET /api/auth/me` consulta a conta autenticada. Todas as rotas de negócio, incluindo opções de cadastro, exigem token válido de uma conta ativa; `/api/health` é público.

Para testar a autenticação e a proteção da API com banco simulado, execute `corepack pnpm test` na pasta `backend`.

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
| `itens_tabela_remuneracao` | Faixas de remuneração e valor/hora |
| `configuracoes_financeiras` | Configuração financeira vigente por colaborador |
| `projetos` | Projetos contratados por cliente |
| `projetos_colaboradores` | Relação entre projeto, colaborador, papel e período |

Regras importantes:

- Registros principais são inativados por `status`, sem exclusão física.
- A bonificação usada nos custos é definida por papel no projeto e por vigência, separadamente da faixa de remuneração.
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

Há reajustes financeiros, troca de papel, bônus com vigências, uma configuração
futura, pessoas e projetos inativos, tarefas compartilhadas, correções, tarefas sem
estimativa ou sem horas e um apontamento sem tarefa. As horas de uma tarefa não são
multiplicadas pela quantidade de responsáveis. Esta entrega não inclui exemplos de premiação.

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
```

As verificações de integração exigem PostgreSQL local em execução e `DATABASE_URL`
configurada. Elas conferem cenários, preservação de ajustes e reexecução sem duplicatas;
não executam reset no banco utilizado pela interface.

O Docker persiste o banco em um volume: recriar o contêiner ou a imagem não limpa
os dados. O seed também não realiza essa limpeza.
