# Segurança e acesso

## Contas e login

- O login aceita nome de usuário ou e-mail e a senha. A conta precisa estar ativa.
- As senhas são guardadas só como hash bcrypt. Usuário inexistente, senha errada e conta inativa recebem a mesma mensagem ("Usuário ou senha inválidos."), e a comparação de senha é feita mesmo quando o usuário não existe, para não revelar quais contas existem.
- As contas vêm do seed (`admin` / `admin123` numa base nova). Não há tela de cadastro de usuários.
- A opção "Lembrar meu usuário" guarda só o identificador no navegador ([login.md](login.md)).

## Sessões

Cada login cria uma sessão no banco (`sessoes`) e devolve um JWT assinado com `JWT_SECRET` (HS256) que carrega o identificador dessa sessão. A validade vem de `JWT_EXPIRATION` (padrão `1d`). Sem `JWT_SECRET`, o login responde 503.

A cada requisição, a API confere a assinatura e também a sessão: ela precisa existir, não estar revogada nem expirada, e a conta precisa continuar ativa. Por isso:

- **Sair** revoga a sessão no servidor; o token deixa de valer mesmo antes de expirar.
- Redefinir a senha invalida todas as sessões abertas da conta.
- Uma conta marcada como inativa perde o acesso na requisição seguinte.

No navegador, o token fica no `sessionStorage`: sobrevive a recargas da aba, mas não é compartilhado com outras abas e some ao fechar a aba.

## Rotas protegidas

Somente `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/esqueci-senha`, `POST /api/auth/redefinir-senha/validar` e `POST /api/auth/redefinir-senha` são públicas. Todas as demais exigem `Authorization: Bearer <token>`, inclusive opções de cadastro, consultas de CNPJ/CEP, relatórios e importações. No front, as páginas internas redirecionam para o login e voltam à página pedida depois da autenticação.

Não existem perfis ou permissões por função: qualquer conta ativa acessa e altera todos os módulos.

## Limite de tentativas

| Rota                 | Por origem (IP) | Por identificador | Janela |
| -------------------- | --------------: | ----------------: | -----: |
| Login                |              60 |                10 | 15 min |
| Esqueci minha senha  |              20 |                 5 | 15 min |
| Conferência do link  |              20 |                10 | 15 min |
| Redefinição de senha |              20 |                10 | 15 min |

O identificador é o login ou o e-mail digitado (sem diferenciar maiúsculas) ou o token de redefinição. Ao passar do limite, a API responde 429 com `Retry-After`. Os contadores ficam no banco (`limites_autenticacao`), então valem para vários processos da API; as chaves são gravadas como HMAC, sem o login em texto. Os limites podem ser ajustados pelas variáveis `AUTH_LOGIN_*`, `AUTH_FORGOT_*` e `AUTH_RESET_*` (`ORIGIN_LIMIT`, `IDENTIFIER_LIMIT`, `WINDOW_MS`).

A API não confia no cabeçalho `X-Forwarded-For`: atrás de um proxy reverso, todas as requisições contam como a mesma origem.

## Senhas e redefinição

- Nova senha: ao menos 8 caracteres, uma letra maiúscula, um número e um símbolo (qualquer caractere que não seja letra, número ou espaço, como `! @ # $ %`), e no máximo 72 bytes UTF-8 (limite do bcrypt; acentos e emojis ocupam mais de um byte). As regras são conferidas na API e repetidas na tela. Senhas já cadastradas continuam entrando; as regras valem ao definir uma senha nova.
- Em **Esqueci minha senha**, o usuário informa o e-mail e recebe o link por e-mail. A resposta é a mesma para e-mails cadastrados ou não, e o envio acontece depois da resposta, para que nem o conteúdo nem o tempo revelem quais e-mails existem. Contas inativas não recebem link. Falhas de envio ficam só no log do servidor.
- Quem administra o servidor também pode gerar o link com `corepack pnpm run senha:link <usuário ou e-mail>`, na pasta `backend`.
- O link vale 30 minutos e só pode ser usado uma vez. A tela de redefinição confere o link assim que abre (`POST /api/auth/redefinir-senha/validar`, com o token no corpo): se ele já foi usado, expirou ou é desconhecido, avisa na hora e não mostra o formulário. Conferir não consome o link. Apenas o hash SHA-256 do token fica no banco, e gerar outro link invalida o anterior.

## Integridade dos dados

- Gravações que dependem de leituras anteriores (apontamentos, vigências, bonificações, equipe, tarefas, premiação e exclusão de projetos) usam transações serializáveis com nova tentativa; se o conflito persistir, a API responde 409 pedindo para atualizar a tela.
- Gatilhos do PostgreSQL protegem o histórico financeiro e os custos faturados também contra escritas diretas no banco ([composicao-financeira.md](composicao-financeira.md), [apontamentos.md](apontamentos.md)).
- Chaves estrangeiras restritivas impedem apagar registros com histórico ([exclusao-projetos.md](exclusao-projetos.md)).

## Respostas de erro

- Dados inválidos: 400 com a lista de campos e mensagens.
- Registro duplicado: 409. Registro inexistente: 404. Banco indisponível: 503.
- Conflitos de custo faturado são traduzidos para mensagens de orientação, sem expor o texto interno do banco.
- Com `NODE_ENV=development` (o padrão quando a variável não é definida), as demais respostas de erro incluem também o stack trace. Fora do ambiente local, defina `NODE_ENV=production`.

## Dados e serviços externos

- A API aceita chamadas de qualquer origem (CORS padrão); o controle de acesso é feito pelo token.
- As consultas de CNPJ (ReceitaWS) e de CEP (ViaCEP) saem do backend e enviam apenas o documento ou o CEP consultado.
- A planilha exportada contém custos internos e valor/hora e é marcada como de uso interno.
- O seed usa pessoas, valores e horas fictícios. Os dois CNPJs do seed são dados públicos de empresas, usados sem relação com os projetos de exemplo.
