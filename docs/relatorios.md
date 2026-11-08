# Relatórios com prévia

A tela **Relatórios** gera um relatório de um recorte escolhido e grava uma cópia dos dados desse momento, a fotografia. A prévia mostra sempre essa cópia: mudanças posteriores em horas, equipes, vigências ou valores não alteram um relatório já gerado. Para ver os números atuais, gere outro.

## Gerar

| Escolha              | Regra                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projetos ou clientes | Uma busca permite combinar vários projetos e clientes. Selecionar um cliente inclui seus projetos. O recorte final aceita até 50 projetos, sem duplicatas |
| Período              | Data inicial, final ou as duas; considera a data dos apontamentos                                                                                         |
| Blocos               | Ao menos um entre Projetos, Clientes, Horas totais, Custo total e Inconsistências; todos vêm marcados                                                     |

É obrigatório informar ao menos um filtro (projetos, clientes ou período) e um bloco. Projetos de qualquer estado entram: os escolhidos sempre, e os demais quando têm dados no período. As seleções são somadas: escolher um cliente e um projeto dele não duplica horas ou custos. Um cliente sem projetos não amplia a busca para outros clientes. Um recorte vazio não gera relatório; a tela pede para ajustar os filtros.

## Personalizar a prévia

Depois de gerar, **Personalizar relatório** abre um modal com os clientes e projetos do recorte e os blocos disponíveis. Marcar ou desmarcar um cliente altera a seleção de seus projetos; também é possível escolher cada projeto individualmente. Ao remover um projeto, todos os blocos da nova fotografia usam esse mesmo recorte: projetos, clientes, horas, custos e inconsistências.

**Gerar nova prévia** consulta os dados atuais, recalcula os totais no servidor e salva outra fotografia, com um novo número. O período original é preservado. A fotografia anterior permanece imutável; esta ação não edita valores manualmente nem promete reproduzir os números antigos se os dados de origem mudaram. **Cancelar**, **Fechar** ou Escape descartam as escolhas do modal sem gerar outra fotografia. Durante a geração, os controles do modal ficam bloqueados; uma falha mantém a seleção para tentar novamente.

As fotografias novas guardam o ID do cliente para agrupar os projetos mesmo quando dois clientes têm o mesmo nome. Fotografias antigas continuam legíveis; no modal, seus projetos ficam independentes quando não há ID de cliente registrado.

**Cancelar**, durante a geração, para de esperar a resposta. Depois, limpa o formulário e a prévia. Se o servidor já tinha gravado o relatório, ele continua registrado e pode ser aberto pelo endereço `/relatorios/<número>`.

## Blocos

| Bloco           | Conteúdo                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Projetos        | Cliente, estado, orçamento, horas, custo base, bonificação, custo total, assertividade do orçamento e inconsistências |
| Clientes        | Projetos, horas, custo base, bonificação e custo total por cliente                                                    |
| Horas totais    | Total, quantidade de apontamentos, horas sem custo, horas sem tarefa, horas por status e por colaborador              |
| Custo total     | Custo total (marcado como parcial quando há horas sem valor/hora), custo base, bonificação e assertividade média      |
| Inconsistências | Quantidade por tipo e a lista de ocorrências da auditoria                                                             |

Os números seguem as fórmulas do Dashboard Geral ([indicadores.md](indicadores.md)) com o custo atual: valor/hora mais bonificação por papel. Com período, a assertividade do orçamento fica indisponível. Quando a composição financeira mudar, os relatórios novos usarão a regra nova; os já gerados mantêm os valores gravados.

## Fotografia

Cada relatório grava, em `relatorios_gerados`:

- autor (a conta logada), data e hora da geração;
- filtros (`projetoIds`, `clienteIds` quando escolhidos, `dataInicio`, `dataFim`) e blocos escolhidos; `projetoIds` registra a união efetiva dos projetos incluídos;
- versão do formato (`versao`, hoje 2), para que relatórios antigos continuem legíveis se o formato mudar;
- o conteúdo: os projetos do recorte e os dados de cada bloco escolhido.

O banco impede alterar ou excluir uma fotografia, inclusive por fora da API. Os projetos do recorte ficam registrados em `relatorios_projetos`, com chave estrangeira restritiva: um projeto que entrou em algum relatório não pode ser excluído definitivamente ([exclusao-projetos.md](exclusao-projetos.md)).

Qualquer conta ativa pode gerar relatórios e abrir os já gerados, como no restante do sistema. O relatório contém custos internos e valor/hora: é de uso interno.

Listar o histórico de relatórios ainda não faz parte desta tela. O **Exportar Excel** do Dashboard Geral continua igual e não grava fotografia.

## Baixar em PDF e Excel

Ao lado de **Personalizar relatório**, os botões **Baixar PDF** e **Baixar Excel** geram o arquivo no servidor a partir da fotografia aberta: os números são os da prévia, mesmo que os dados tenham mudado depois, e entram só os blocos escolhidos. O download usa o login atual. A tela avisa o nome do arquivo baixado ou o motivo da falha.

O nome do arquivo traz o número do relatório, os clientes ou projetos e o período, por exemplo `relatorio-12-portal-do-cliente-2026-10-01-a-2026-10-31.pdf`, `relatorio-13-cliente-marina-oliveira-todos-os-periodos.xlsx`, `relatorio-14-3-projetos-desde-2026-09-01.pdf` ou `relatorio-15-todos-os-projetos-ate-2026-10-31.pdf`.

| Formato | Conteúdo                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF     | A4 deitado. Primeira página com número, data, autor, versão, período, clientes, projetos e blocos; depois cada bloco com seus indicadores e tabelas. Linhas não são cortadas entre páginas, o cabeçalho das tabelas se repete e o rodapé numera as páginas. |
| Excel   | Aba Relatório com o cabeçalho e os projetos do recorte, e uma aba por bloco escolhido (Horas totais ganha também a aba Horas por colaborador). As listas são Tabelas do Excel, com valores numéricos e formato de moeda, número e percentual.               |

Os dois arquivos trazem o aviso de uso interno, porque contêm custos e valor/hora. Fotografias dos formatos 1 e 2 são exportadas; um formato que esta versão do sistema não conhece responde 409, em vez de gerar um arquivo com números trocados.

## API

```txt
POST /api/relatorios        projetoIds, clienteIds, dataInicio, dataFim, blocos → 201 com a fotografia
GET  /api/relatorios/:id    a mesma fotografia, sem recalcular
GET  /api/relatorios/:id/pdf    arquivo PDF da fotografia
GET  /api/relatorios/:id/xlsx   arquivo Excel da fotografia
```

Exemplo:

```json
{
  "projetoIds": [1, 3],
  "dataInicio": "2026-10-01",
  "dataFim": "2026-10-31",
  "blocos": ["PROJETOS", "HORAS", "CUSTO"]
}
```

Respostas de erro: 400 para pedido inválido (sem filtro, sem bloco, período invertido, projeto inexistente, campo desconhecido), 422 para recorte sem dados, 404 para relatório inexistente e 401 sem login. A resposta traz `id`, `versao`, `filtros`, `blocos`, `autor`, `criadoEm` e `conteudo`.

## Migração e validação

A migração `20261108010000_relatorios_gerados` cria as duas tabelas e os gatilhos; não altera dados existentes. Aplique-a e gere o Prisma Client antes de iniciar a versão atualizada:

```powershell
cd backend
corepack pnpm exec prisma migrate deploy
corepack pnpm run prisma:generate
```

`corepack pnpm run test:reports-db`, na pasta `backend`, usa um schema temporário no PostgreSQL local. Confere os números da fotografia contra o dashboard, os blocos escolhidos, o recorte por período, a recusa do recorte vazio, a cópia inalterada depois de mudar um apontamento, a proteção no banco, o bloqueio da exclusão do projeto, os arquivos PDF e Excel lidos da fotografia (inclusive depois de mudar os dados) e a API autenticada.

O CI também executa esse teste, incluindo geração por cliente sem duplicação e geração de outra fotografia com um recorte menor.
