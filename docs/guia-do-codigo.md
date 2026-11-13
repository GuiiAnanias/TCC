# Guia do código

Todo arquivo de código começa com um comentário que diz o que ele faz, e cada função importante
tem um comentário logo acima. Os comentários usam etiquetas fixas: com Ctrl+F (ou Ctrl+Shift+F no
VS Code, para buscar em todos os arquivos) dá para achar, por exemplo, todas as validações do
sistema procurando `[VALIDACAO]`.

## Etiquetas

| Etiqueta           | Onde aparece                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `[INICIO]`         | Pontos de entrada: `backend/src/server.js`, `backend/src/app.js`, `frontend/src/main.jsx` |
| `[ROTA]`           | Caminhos da API (`backend/src/http/routes`) e rotas das telas (`frontend/src/App.jsx`)    |
| `[CONTROLLER]`     | Recebe a requisição, valida a entrada e chama o service                                   |
| `[SCHEMA]`         | Schemas Zod que descrevem os dados aceitos                                                |
| `[VALIDACAO]`      | Toda conferência de dados: formatos, obrigatórios, datas, limites                         |
| `[SERVICE]`        | Camada de regras de negócio                                                               |
| `[REGRA]`          | Uma regra de negócio específica (24 h por dia, faturado não edita, sem sobreposição)      |
| `[REPOSITORY]`     | Acesso ao banco pelo Prisma                                                               |
| `[BANCO]`          | Consultas, gravações e o modelo de dados                                                  |
| `[TRANSACAO]`      | Transações e travas contra gravações simultâneas                                          |
| `[ERRO]`           | Tratamento de erros e mensagens devolvidas ao usuário                                     |
| `[SEGURANCA]`      | Login, sessões, senhas, tokens, limites de tentativas                                     |
| `[API-EXTERNA]`    | ReceitaWS (CNPJ), ViaCEP (CEP) e envio de e-mail                                          |
| `[TELA]`           | Telas e partes de tela do front                                                           |
| `[COMPONENTE]`     | Componentes reaproveitados do front                                                       |
| `[REQUISICAO]`     | Onde o front chama a API                                                                  |
| `[ESTADO]`         | Estado guardado no front (tema, sessão, filtros, tamanho do texto)                        |
| `[ACESSIBILIDADE]` | Teclado, leitor de tela e tamanho do texto                                                |
| `[ESTILO]`         | `frontend/src/styles.css`                                                                 |

As etiquetas não têm acento de propósito: a busca acha `[VALIDACAO]` do mesmo jeito em qualquer
teclado.

## Caminho de uma requisição

```txt
Tela (frontend/src/pages)            [TELA] [REQUISICAO]
  -> api/conexao.js (axios + token)   [SEGURANCA]
  -> http/routes/*Routes.js          [ROTA]
  -> middlewares/autenticar.js     [SEGURANCA]  (rotas protegidas)
  -> http/controllers/*Controller.js [CONTROLLER]
  -> schemas/*Schemas.js (Zod)       [SCHEMA] [VALIDACAO]
  -> services/*Service.js            [SERVICE] [REGRA]
  -> repositories/*Repository.js     [REPOSITORY] [BANCO] [TRANSACAO]
  -> Prisma -> PostgreSQL            (gatilhos das migrations)
Erro em qualquer etapa -> middlewares/tratamentoErros.js [ERRO] -> JSON com status e mensagem
```

Exemplo: o campo CNPJ do formulário de cliente sai de `pages/CadastroPage.jsx` (`handleSubmit`), chega
em `POST /api/clientes` (`clientesRoutes.js`), passa por `clientesController.store`, é validado em
`schemas/clientesSchemas.js` (dígitos verificadores em `utils/cnpj.js`), tem a duplicidade
conferida em `services/clientesService.js` e é gravado por `repositories/clientesRepository.js`.

## Migrations

As migrations (`backend/prisma/migrations/*/migration.sql`) não recebem comentários novos: o
Prisma guarda uma soma de verificação de cada migration já aplicada, e alterar o arquivo faria
os bancos existentes acusarem diferença. O que cada uma faz:

| Migration                                        | O que faz                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `20260904010000_init`                            | Tabelas iniciais: usuários, clientes, colaboradores, remuneração, projetos                            |
| `20260919…` a `20260920…`                        | Apontamentos de horas e o enum de status (Pendente, Aprovado, Faturado)                               |
| `20261001…_cliente_empresa` / `_pessoa_fisica`   | Campos de empresa (ReceitaWS) e clientes pessoa física                                                |
| `20261017160000_bonificacao_por_papel`           | Bonificação por papel no projeto, com vigência                                                        |
| `20261017180000_cliente_pf_contatos_unicos`      | E-mail e telefone únicos entre clientes PF                                                            |
| `20261017200000_historico_financeiro_preservado` | Vigências de valor/hora; gatilho `financeiro_historico_imutavel` impede editar ou apagar o histórico  |
| `20261018100000_tarefas_sprints`                 | Tarefas, sprints e responsáveis                                                                       |
| `20261018200000_avaliacao_premiacao`             | Regras e avaliações de premiação; gatilhos tornam regras publicadas e avaliações concluídas imutáveis |
| `20261103010000_equipe_periodos_unicos`          | Impede participações com períodos sobrepostos na equipe do projeto                                    |
| `20261103020000_custos_faturados_preservados`    | Gatilhos que gravam a composição do custo ao faturar e barram mudanças que alterariam custo faturado  |
| `20261104010000_sessoes_revogaveis`              | Tabela de sessões (logout derruba o token)                                                            |
| `20261104020000_limites_autenticacao`            | Contadores de tentativas de login e de recuperação de senha                                           |
| `20261106010000_estados_contratos_projetos`      | Status do projeto (Ativo, Pausado, Encerrado, Cancelado) e tipos de contrato                          |
| `20261107010000_referencias_projetos_avaliacoes` | Liga avaliações aos projetos usados (impede excluir esses projetos)                                   |
| `20261108010000_relatorios_gerados`              | Relatórios gerados (cópia imutável dos dados)                                                         |
| `20261108020000_relatorios_exportacoes`          | Registro de cada download de PDF ou Excel                                                             |
| `20261110010000_historico_importacoes`           | Histórico de importações de horas (imutável)                                                          |
| `20261111010000_tipos_contrato_genericos`        | Tipos de contrato Escopo fechado, Por hora, Fee mensal e Squad                                        |

## Onde mostrar na banca

| Pergunta provável                                 | Abrir                                                           | Buscar               |
| ------------------------------------------------- | --------------------------------------------------------------- | -------------------- |
| Onde as rotas da API são registradas?             | `backend/src/http/routes/index.js`                              | `[ROTA]`             |
| Onde o campo de um formulário chega no backend?   | `pages/CadastroPage.jsx` (`handleSubmit`) e o `*Controller.js`  | `[REQUISICAO]`       |
| Para que servem controller, service e repository? | cabeçalho de cada arquivo                                       | `[CONTROLLER]`       |
| Onde está a validação do CNPJ?                    | `schemas/clientesSchemas.js` e `utils/cnpj.js`                  | `[VALIDACAO]`        |
| Validam no front ou no back?                      | `config/cadastros.jsx` e `backend/src/schemas`                  | `[VALIDACAO]`        |
| Onde está a regra das 24 h por dia?               | `services/apontamentosService.js`                               | `24 h`               |
| Id inválido na URL?                               | `utils/lerId.js`                                                | `lerId`              |
| Regra da senha forte?                             | `schemas/senhaSchemas.js`                                       | `senha forte`        |
| Como os erros são tratados?                       | `http/middlewares/tratamentoErros.js`                           | `[ERRO]`             |
| O que é o ErroHttp?                               | `utils/ErroHttp.js`                                             | `ErroHttp`           |
| E se a ReceitaWS cair?                            | `services/cnpjService.js`                                       | `[API-EXTERNA]`      |
| Como o front mostra o erro da API?                | `utils/baixarArquivos.js` (`mensagemDeErro`) e `api/conexao.js` | `[ERRO]`             |
| Onde está a tabela de clientes?                   | `backend/prisma/schema.prisma` (`model Cliente`)                | `[BANCO]`            |
| O que é uma migration?                            | esta página e `prisma/migrations`                               | `migration`          |
| Como o custo faturado não muda?                   | migration `custos_faturados_preservados`                        | `faturado`           |
| Como o Prisma se conecta?                         | `config/prisma.js` e `config/env.js`                            | `DATABASE_URL`       |
| Como funciona o login?                            | `http/routes/autenticacaoRoutes.js`                             | `[SEGURANCA]`        |
| Como protegem as rotas?                           | `http/middlewares/autenticar.js`                                | `[SEGURANCA]`        |
| E se tentarem adivinhar a senha?                  | `http/middlewares/limiteAutenticacao.js`                        | `Muitas tentativas`  |
| Como funciona o esqueci minha senha?              | `services/senhaService.js`                                      | `[SEGURANCA]`        |
| Como a planilha é lida?                           | `services/importacaoApontamentosService.js`                     | `lerPlanilha`        |
| Onde é calculado o custo do dashboard?            | `services/custosDashboard.js`                                   | `custo base`         |
| Como o PDF é gerado?                              | `services/relatoriosArquivosService.js`                         | `montarPdfRelatorio` |
| Transação e concorrência?                         | `repositories/apontamentosRepository.js`                        | `[TRANSACAO]`        |
| Como o front sabe se está logado?                 | `frontend/src/autenticacao/AutenticacaoContext.jsx`             | `[SEGURANCA]`        |
