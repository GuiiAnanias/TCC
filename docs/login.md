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

O fluxo atual de solicitar um link ao administrador permanece disponível. Envio automático por e-mail e alterações de prazo do token de recuperação serão tratados em uma funcionalidade separada.

## Critérios de aceite

1. Marcar a opção, autenticar com sucesso, sair e recarregar a tela: identificação preenchida, opção marcada e senha vazia.
2. Desmarcar e recarregar sem autenticar: identificação vazia e opção desmarcada.
3. Tentar autenticar com credenciais inválidas e a opção marcada: mensagem de erro, sem nova identificação persistida.
4. Autenticar com a opção desmarcada: acesso normal, sem criar lembrança.
5. Bloquear o armazenamento do navegador: acesso normal, sem erro de preferência interrompendo a autenticação.
