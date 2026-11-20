# Clientes pessoa física e jurídica

O cadastro de clientes atende pessoas jurídicas (PJ) e pessoas físicas (PF). O tipo é escolhido ao abrir o cadastro e não pode ser trocado depois: para mudar, cadastre outro cliente.

## Campos por tipo

| Campo                                                                                                         | PJ               | PF              |
| ------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- |
| Nome (razão social ou nome da pessoa)                                                                         | Obrigatório      | Obrigatório     |
| Documento                                                                                                     | CNPJ obrigatório | CPF obrigatório |
| E-mail e telefone                                                                                             | Opcionais        | Opcionais       |
| Endereço (CEP, logradouro, número, complemento, bairro, cidade, UF)                                           | Opcional         | Opcional        |
| Nome fantasia, pessoa de contato, situação cadastral, abertura, porte, natureza jurídica, atividade principal | Opcionais        | Não aceitos     |

A API recusa CPF em cliente PJ e campos de empresa em cliente PF, tanto no cadastro quanto na edição.

## Validações

- **CNPJ**: confere os dígitos verificadores. Aceita o formato numérico e o alfanumérico (12 caracteres de letras ou números seguidos de 2 dígitos). Pontos, barra e traço são removidos antes de gravar.
- **CPF**: confere os dígitos verificadores; a pontuação é removida.
- **Telefone**: DDD mais 10 ou 11 dígitos.
- **CEP**: 8 dígitos. **UF**: sigla de um estado brasileiro.
- **Duplicidade**: CNPJ e CPF são únicos entre todos os clientes. Entre PJ, o nome também não se repete. Entre PF, e-mail e telefone não se repetem (o e-mail é comparado sem diferenciar maiúsculas; o telefone, só pelos dígitos).

## Consultas de CNPJ e CEP

As consultas apenas preenchem o formulário. Nada é gravado até clicar em Salvar, e os dados podem ser conferidos e ajustados antes.

| Consulta | Serviço externo                        | Rota da API                    | Tempo limite | Cache local |
| -------- | -------------------------------------- | ------------------------------ | ------------ | ----------- |
| CNPJ     | ReceitaWS (`receitaws.com.br/v1/cnpj`) | `GET /api/clientes/cnpj/:cnpj` | 12 s         | 10 min      |
| CEP      | ViaCEP (`viacep.com.br/ws`)            | `GET /api/clientes/cep/:cep`   | 8 s          | 10 min      |

A consulta de CNPJ preenche razão social, nome fantasia, e-mail, telefone, endereço, situação cadastral, data de abertura, porte, natureza jurídica e atividade principal. A de CEP roda sozinha ao completar os 8 dígitos e preenche logradouro, bairro, cidade e UF, sem apagar o que for digitado enquanto ela acontece.

Quando o serviço externo está fora do ar, demora, atinge o limite de consultas (a ReceitaWS pública permite 3 por minuto) ou não encontra o documento, a tela mostra o motivo e o cadastro pode ser preenchido à mão. Não existe consulta de CPF.

A situação cadastral vinda da ReceitaWS é só informativa: o status Ativo/Inativo do cliente no sistema é independente dela.

## Inativação e uso nos projetos

Excluir um cliente pela tela ou por `DELETE /api/clientes/:id` apenas o marca como Inativo; o registro e os projetos continuam disponíveis para consulta. Um cliente inativo não pode receber novos projetos, nem ser escolhido ao trocar o cliente de um projeto existente.

A listagem busca por nome, nome fantasia, CNPJ, CPF, cidade e e-mail, e filtra por status.

## API

```txt
GET    /api/clientes              ?busca=&status=ATIVO|INATIVO
GET    /api/clientes/:id
POST   /api/clientes              tipoPessoa (PF|PJ, padrão PJ) + campos acima
PUT    /api/clientes/:id          campos parciais; tipoPessoa não muda
DELETE /api/clientes/:id          inativa
GET    /api/clientes/cnpj/:cnpj
GET    /api/clientes/cep/:cep
```

Todas as rotas exigem login.
