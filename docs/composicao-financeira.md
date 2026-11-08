# Vigências e composição financeira

O custo de um apontamento usa três cadastros, cada um com vigência própria: a configuração financeira do colaborador (valor/hora), a participação dele na equipe do projeto (papel) e a bonificação do papel. Cargo e departamento do colaborador descrevem a atuação e não definem valores.

## Tabela de remuneração

Cada item tem um nível do catálogo (Trainee, Júnior, Pleno e Sênior, de I a V), único na tabela, e um valor/hora de pelo menos R$ 0,01, com até duas casas decimais.

- Editar o valor/hora de um item vale só para novas vigências. As configurações já criadas guardam o valor da época.
- Inativar um item (ação Excluir) impede usá-lo em novas vigências, sem alterar as existentes.
- As colunas `bonificacao` e `tipoBonificacao` de `itens_tabela_remuneracao` são legadas: continuam no banco, mas não aparecem na tela, não são aceitas pela API e não entram no custo.

## Configuração financeira do colaborador

Na lista de colaboradores, a ação **Financeiro** abre o histórico de vigências da pessoa. Cada vigência registra:

| Dado                     | Origem                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Nível e valor/hora       | Copiados do item da tabela no momento do cadastro e preservados |
| Benefícios (R$)          | Informados; não negativos, com até duas casas decimais          |
| Início e fim             | Início informado; o fim é preenchido ao substituir ou encerrar  |
| Motivo                   | Opcional, até 500 caracteres; o padrão é "Nova vigência"        |
| Vigência anterior, autor | Gravados pelo sistema para rastrear a substituição e quem a fez |

Regras de datas:

- O colaborador precisa estar ativo e o item da tabela também.
- A nova vigência começa depois do início de todas as anteriores e depois do fim de qualquer vigência encerrada.
- A partir da segunda vigência, o início também precisa ser posterior ao último apontamento da pessoa, para não mudar o custo de horas já registradas. A primeira pode começar antes e cobrir horas que estavam sem valor/hora.
- Ao criar uma nova vigência, a anterior termina no dia anterior ao novo início. Só existe uma vigência aberta por pessoa.
- Uma vigência com início futuro aparece como **Agendada**.
- **Encerrar** usa hoje como último dia e não vale para vigência agendada.

O histórico é imutável. Um gatilho do banco impede editar valores, datas de início ou autores, reabrir uma vigência encerrada e excluir registros, inclusive por fora da API. Para mudar valor/hora ou benefícios, cadastre uma nova vigência; o botão **Usar como base** preenche o formulário com a faixa e os benefícios anteriores.

## Papel no projeto

O papel é escolhido ao vincular a pessoa à equipe do projeto, em um catálogo próprio (Dev, Product Owner, Scrum Master, Tech Lead, QA e outros, listados em `GET /api/projetos/papeis`). É independente do cargo.

- A troca de papel informa a data de vigência: a participação atual termina no dia anterior e outra começa com o novo papel. A data precisa ser posterior à entrada atual.
- Uma pessoa não pode ter duas participações com períodos sobrepostos no mesmo projeto, nem duas abertas ao mesmo tempo. O banco também garante essas regras.
- Encerrar a participação preenche a saída com a data de hoje (ou com a entrada, se ela ainda for futura); o histórico continua disponível.
- Alterações de equipe exigem projeto Ativo ([projetos.md](projetos.md)).

## Bonificação por papel

Na tela **Remuneração**, a seção **Bonificação por papel no projeto** define um percentual por papel, com data de início.

- O cadastro é opcional: papel sem regra vigente usa 0%, sem bloquear indicadores nem faturamento.
- Uma nova regra para o mesmo papel precisa começar depois da regra aberta; a anterior vale até o dia anterior a esse início.
- Para encerrar uma bonificação, cadastre uma nova regra com 0%. As regras não são editadas nem excluídas.

## Custo de um apontamento

Para cada apontamento, o sistema procura o que estava vigente na data das horas:

```txt
custo base   = horas × valor/hora da configuração financeira vigente
bonificação  = custo base × percentual da bonificação do papel ÷ 100
custo        = custo base + bonificação
```

Custo base e bonificação são arredondados para centavos em cada apontamento, antes de qualquer soma.

- Sem configuração financeira vigente, as horas ficam sem custo e o total do projeto é apresentado como parcial.
- Sem participação da pessoa na equipe na data, não há papel: o custo usa só o valor/hora, sem bonificação, e a auditoria aponta a ausência de vínculo.
- Apontamentos faturados usam a composição gravada no faturamento ([apontamentos.md](apontamentos.md)).

## O que não entra no custo

O custo atual é somente valor/hora mais bonificação por papel. Não entram:

- os benefícios registrados na vigência;
- rateio de ociosidade ou de capacidade disponível;
- bônus de valor fixo;
- o resultado da avaliação de premiação ([premiacao.md](premiacao.md)).

Incluir qualquer um desses itens depende de a empresa definir a regra (como ratear benefícios, sobre qual base aplicar percentuais, a periodicidade de valores fixos e como combinar bônus). O sistema não presume fórmula.

## API

```txt
GET    /api/remuneracoes                                   ?busca=&status=
POST   /api/remuneracoes                                   nivel, valorHora, status
PUT    /api/remuneracoes/:id
DELETE /api/remuneracoes/:id                               inativa

GET    /api/colaboradores/:id/configuracoes-financeiras
POST   /api/colaboradores/:id/configuracoes-financeiras    itemTabelaId, beneficios, dataInicio, motivo
PUT    /api/colaboradores/:id/configuracoes-financeiras/:configuracaoId
                                                           cria nova vigência a partir de dataVigencia
DELETE /api/colaboradores/:id/configuracoes-financeiras/:configuracaoId
                                                           encerra com a data de hoje

GET    /api/bonificacoes-papeis
POST   /api/bonificacoes-papeis                            papel, percentual, dataInicio

GET    /api/projetos/papeis
POST   /api/projetos/:id/equipe                            colaboradorId, papel, dataEntrada
PUT    /api/projetos/:id/equipe/:vinculoId                 papel + dataVigencia, ou datas
DELETE /api/projetos/:id/equipe/:vinculoId                 encerra a participação hoje
```

Alterações que mudariam o custo de apontamentos faturados são recusadas com 409 (ver [apontamentos.md](apontamentos.md)).
