/**
 * [ERRO][BANCO] Traduz os erros lançados pelos gatilhos do PostgreSQL que protegem o custo de
 * apontamentos faturados em respostas 409 com orientação ao usuário.
 */

import { HttpError } from "./HttpError.js";

class CustoConflict extends HttpError {}

// Traduz somente as violações das regras de consolidação conhecidas. Nunca
// devolve mensagens internas do PostgreSQL/Prisma para o usuário.
export function custoConflict(error) {
  if (error instanceof CustoConflict) return error;
  const message = String(error.message ?? "");
  if (message.includes("CODEBI_CUSTO_PENDENTE:"))
    return new CustoConflict(
      409,
      "Não é possível faturar: confira o valor/hora, a participação na equipe e as vigências de bonificação na data das horas. Corrija as pendências antes de faturar.",
    );
  if (message.includes("CODEBI_CUSTO_RETROATIVO:"))
    return new CustoConflict(
      409,
      "A alteração afetaria custos já faturados. Para corrigir, volte os apontamentos envolvidos para Aprovado, ajuste os dados e fature novamente.",
    );
  if (message.includes("CODEBI_CUSTO_TRAVADO:"))
    return new CustoConflict(
      409,
      "O custo faturado é preservado. Volte o apontamento para Aprovado e salve antes de corrigir.",
    );
  return null;
}
