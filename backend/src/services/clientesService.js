/**
 * [SERVICE][REGRA] Regras de negócio de clientes: duplicidade de CNPJ/CPF/nome/contatos, tipo de
 * pessoa fixo e inativação. Recebe dados já validados pelo schema e usa o clientesRepository para o
 * banco.
 */

import { clientesRepository } from "../repositories/clientesRepository.js";
import { ErroHttp } from "../utils/ErroHttp.js";

// [ERRO] Cliente inexistente: 404 "Cliente não encontrado."
async function ensureClienteExists(id) {
  const cliente = await clientesRepository.findById(id);

  if (!cliente) {
    throw new ErroHttp(404, "Cliente não encontrado.");
  }

  return cliente;
}

// [REGRA] Pessoa física: e-mail e telefone não podem repetir entre clientes PF.
async function ensureUniqueIndividualContacts(data, excludeId) {
  if (data.email && (await clientesRepository.findIndividualByEmail(data.email, excludeId))) {
    throw new ErroHttp(409, "Já existe uma pessoa física com este e-mail.");
  }
  if (
    data.telefone &&
    (await clientesRepository.findIndividualByTelefone(data.telefone, excludeId))
  ) {
    throw new ErroHttp(409, "Já existe uma pessoa física com este telefone.");
  }
}

export const clientesService = {
  list(filters) {
    return clientesRepository.findAll(filters);
  },

  async getById(id) {
    return ensureClienteExists(id);
  },

  // [REGRA][ERRO] Recusa CNPJ, CPF ou nome de empresa já cadastrados com 409 (ex.: "Já existe um
  // cliente com este CNPJ.").
  async create(data) {
    if (data.cpf && (await clientesRepository.findByCpf(data.cpf)))
      throw new ErroHttp(409, "Já existe um cliente com este CPF.");
    if (data.cnpj && (await clientesRepository.findByCnpj(data.cnpj)))
      throw new ErroHttp(409, "Já existe um cliente com este CNPJ.");
    if (data.tipoPessoa === "PF") await ensureUniqueIndividualContacts(data);
    const cliente =
      data.tipoPessoa === "PF" ? null : await clientesRepository.findByNome(data.nome);

    if (cliente) {
      throw new ErroHttp(409, "Já existe um cliente com este nome.");
    }

    return clientesRepository.create(data);
  },

  // [REGRA] Na edição o tipo (PF/PJ) não muda e as mesmas regras de duplicidade valem, ignorando o
  // próprio registro.
  async update(id, data) {
    const current = await ensureClienteExists(id);
    const tipoPessoa = current.tipoPessoa || "PJ";
    if (data.tipoPessoa && data.tipoPessoa !== tipoPessoa)
      throw new ErroHttp(
        400,
        "O tipo de um cliente cadastrado não pode ser alterado. Cadastre um novo cliente.",
      );
    if (tipoPessoa === "PJ" && data.cpf)
      throw new ErroHttp(400, "CPF pertence a uma pessoa física.");
    if (tipoPessoa === "PF") {
      if (
        [
          "cnpj",
          "nomeFantasia",
          "contato",
          "situacaoCadastral",
          "abertura",
          "porte",
          "naturezaJuridica",
          "atividadePrincipal",
        ].some((field) => data[field])
      )
        throw new ErroHttp(400, "Dados de empresa não pertencem a uma pessoa física.");
      if (data.cpf === null) throw new ErroHttp(400, "Informe o CPF.");
      if (data.cpf) {
        const duplicate = await clientesRepository.findByCpf(data.cpf);
        if (duplicate && duplicate.id !== id)
          throw new ErroHttp(409, "Já existe um cliente com este CPF.");
      }
      await ensureUniqueIndividualContacts(data, id);
    }
    if (data.cnpj) {
      const duplicate = await clientesRepository.findByCnpj(data.cnpj);
      if (duplicate && duplicate.id !== id)
        throw new ErroHttp(409, "Já existe um cliente com este CNPJ.");
    }

    if (data.nome && tipoPessoa === "PJ") {
      const cliente = await clientesRepository.findByNome(data.nome);

      if (cliente && cliente.id !== id) {
        throw new ErroHttp(409, "Já existe um cliente com este nome.");
      }
    }

    return clientesRepository.update(id, data);
  },

  // [REGRA] "Excluir" marca como Inativo; projetos e histórico continuam.
  async inactivate(id) {
    await ensureClienteExists(id);
    return clientesRepository.update(id, { status: "INATIVO" });
  },
};
