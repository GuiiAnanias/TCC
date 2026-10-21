import { clientesRepository } from "../repositories/clientesRepository.js";
import { HttpError } from "../utils/HttpError.js";

async function ensureClienteExists(id) {
  const cliente = await clientesRepository.findById(id);

  if (!cliente) {
    throw new HttpError(404, "Cliente não encontrado.");
  }

  return cliente;
}

async function ensureUniqueIndividualContacts(data, excludeId) {
  if (data.email && await clientesRepository.findIndividualByEmail(data.email, excludeId)) {
    throw new HttpError(409, "Já existe uma pessoa física com este e-mail.");
  }
  if (data.telefone && await clientesRepository.findIndividualByTelefone(data.telefone, excludeId)) {
    throw new HttpError(409, "Já existe uma pessoa física com este telefone.");
  }
}

export const clientesService = {
  list(filters) {
    return clientesRepository.findAll(filters);
  },

  async getById(id) {
    return ensureClienteExists(id);
  },

  async create(data) {
    if (data.cpf && await clientesRepository.findByCpf(data.cpf)) throw new HttpError(409, "Já existe um cliente com este CPF.");
    if (data.cnpj && await clientesRepository.findByCnpj(data.cnpj)) throw new HttpError(409, "Já existe um cliente com este CNPJ.");
    if (data.tipoPessoa === "PF") await ensureUniqueIndividualContacts(data);
    const cliente = data.tipoPessoa === "PF" ? null : await clientesRepository.findByNome(data.nome);

    if (cliente) {
      throw new HttpError(409, "Já existe um cliente com este nome.");
    }

    return clientesRepository.create(data);
  },

  async update(id, data) {
    const current = await ensureClienteExists(id);
    const tipoPessoa = current.tipoPessoa || "PJ";
    if (data.tipoPessoa && data.tipoPessoa !== tipoPessoa) throw new HttpError(400, "O tipo de um cliente cadastrado não pode ser alterado. Cadastre um novo cliente.");
    if (tipoPessoa === "PJ" && data.cpf) throw new HttpError(400, "CPF pertence a uma pessoa física.");
    if (tipoPessoa === "PF") {
      if (["cnpj", "nomeFantasia", "contato", "situacaoCadastral", "abertura", "porte", "naturezaJuridica", "atividadePrincipal"].some((field) => data[field])) throw new HttpError(400, "Dados de empresa não pertencem a uma pessoa física.");
      if (data.cpf === null) throw new HttpError(400, "Informe o CPF.");
      if (data.cpf) {
        const duplicate = await clientesRepository.findByCpf(data.cpf);
        if (duplicate && duplicate.id !== id) throw new HttpError(409, "Já existe um cliente com este CPF.");
      }
      await ensureUniqueIndividualContacts(data, id);
    }
    if (data.cnpj) {
      const duplicate = await clientesRepository.findByCnpj(data.cnpj);
      if (duplicate && duplicate.id !== id) throw new HttpError(409, "Já existe um cliente com este CNPJ.");
    }

    if (data.nome && tipoPessoa === "PJ") {
      const cliente = await clientesRepository.findByNome(data.nome);

      if (cliente && cliente.id !== id) {
        throw new HttpError(409, "Já existe um cliente com este nome.");
      }
    }

    return clientesRepository.update(id, data);
  },

  async inactivate(id) {
    await ensureClienteExists(id);
    return clientesRepository.update(id, { status: "INATIVO" });
  }
};
