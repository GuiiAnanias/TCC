# Login e lembrança de usuário

O acesso aceita nome de usuário ou e-mail e a senha da conta. Após autenticação, a aplicação retorna à rota interna solicitada, quando disponível, ou ao dashboard geral.

## Lembrar meu usuário neste navegador

- A opção começa desmarcada quando não há identificação lembrada.
- Quando marcada, uma autenticação bem-sucedida guarda somente o usuário ou e-mail informado, sem espaços externos.
- No próximo acesso pelo mesmo navegador e origem da aplicação, o identificador aparece preenchido e a opção continua marcada. A aplicação não preenche a senha.
- Desmarcar remove imediatamente a lembrança desse navegador, mesmo sem enviar novamente o formulário. O valor digitado permanece disponível no formulário atual.
- Falha de autenticação não grava nem substitui o identificador lembrado.
- Limpar os dados do site ou usar outro navegador/origem remove ou não compartilha essa preferência. Se o armazenamento estiver bloqueado ou sem espaço, a autenticação continua funcionando; a lembrança pode não estar disponível.

A preferência usa a chave `code-bi-remembered-login` no armazenamento local do navegador. Não grava senha, token ou informação de recuperação de conta. A política de sessão, sua duração e a revogação no logout permanecem as existentes.

Essa escolha é local ao dispositivo: um booleano no cadastro da conta, sozinho, não permitiria identificar quem acessa antes da autenticação. Portanto, a regra documental de Lembrar-me deve descrever o preenchimento local do identificador, sem prometer login persistente.

## Recuperação de senha

O link **Esqueci minha senha**, na tela de login, abre a tela `/esqueci-senha`:

- Um painel explica o processo: informar o e-mail da conta e receber um link para escolher a nova senha.
- O campo de e-mail é obrigatório; vazio ou em formato inválido, a tela mostra o erro e não envia o pedido.
- Ao enviar, a tela mostra sempre "Caso o e-mail informado esteja cadastrado, será enviado um link de redefinição de senha.", sem indicar se o e-mail existe.
- Se o e-mail pertencer a uma conta ativa, o sistema envia um e-mail com o link para `/redefinir-senha`, de uso único e válido por 30 minutos. Um novo pedido invalida o link anterior.
- Esta tela não altera a senha: a troca acontece somente na tela aberta pelo link, que encerra as sessões abertas da conta.
- Na tela de redefinição, ao clicar no campo **Nova senha** aparece uma lista com as regras (pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo), marcadas conforme a senha é digitada. A lista flutua sobre a tela, sem empurrar os campos, e some ao sair do campo.
- Depois de salvar a nova senha, a tela mostra "Senha atualizada com sucesso" e, em 3 segundos, volta sozinha ao login, que repete a confirmação. O link **Ir para o login** continua disponível.
- Ao abrir o link, a tela de redefinição confere se ele ainda vale. Se já foi usado, expirou ou é desconhecido, mostra "Este link já foi usado, expirou ou não é válido." com o atalho para pedir outro, sem exibir o formulário. Se a conferência falhar por conexão, a tela oferece tentar de novo.

Em desenvolvimento e na demonstração, os e-mails chegam ao Mailpit ([http://localhost:8025](http://localhost:8025)), que sobe junto do banco com `docker compose up -d`. O administrador continua podendo gerar o link manualmente com `corepack pnpm run senha:link <usuário ou e-mail>`.

## Critérios de aceite

1. Marcar a opção, autenticar com sucesso, sair e recarregar a tela: identificação preenchida, opção marcada e senha vazia.
2. Desmarcar e recarregar sem autenticar: identificação vazia e opção desmarcada.
3. Tentar autenticar com credenciais inválidas e a opção marcada: mensagem de erro, sem nova identificação persistida.
4. Autenticar com a opção desmarcada: acesso normal, sem criar lembrança.
5. Bloquear o armazenamento do navegador: acesso normal, sem erro de preferência interrompendo a autenticação.
