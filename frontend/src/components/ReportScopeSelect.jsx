/**
 * [COMPONENTE] Campo "Projetos ou clientes" do relatório: uma busca que aceita os dois.
 */

import React from "react";
import { MultiSelect } from "./MultiSelect.jsx";
import { projectStatusLabel } from "../config/projectOptions.js";

/** Uma busca, mantendo a identidade de clientes e projetos mesmo com nomes iguais. */
export function ReportScopeSelect({ projetos, clientes, form, onChange, disabled }) {
  const nomes = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]));
  const options = [
    ...clientes.map((cliente) => ({
      value: `cliente:${cliente.id}`,
      label: `Cliente: ${cliente.nome}`,
    })),
    ...projetos.map((projeto) => ({
      value: `projeto:${projeto.id}`,
      label: `Projeto: ${projeto.nome} · ${nomes.get(projeto.clienteId) ?? "Cliente não informado"}${projeto.status && projeto.status !== "ATIVO" ? ` · ${projectStatusLabel(projeto.status).toLowerCase()}` : ""}`,
    })),
  ];
  return (
    <MultiSelect
      id="relatorio-projetos"
      name="escopo"
      options={options}
      value={[
        ...(form.clienteIds ?? []).map((id) => `cliente:${id}`),
        ...form.projetoIds.map((id) => `projeto:${id}`),
      ]}
      onChange={({ target: { value } }) =>
        onChange({
          projetoIds: value.filter((id) => id.startsWith("projeto:")).map((id) => id.split(":")[1]),
          clienteIds: value.filter((id) => id.startsWith("cliente:")).map((id) => id.split(":")[1]),
        })
      }
      placeholder="Buscar projetos ou clientes"
      plural="seleções"
      labelledBy="relatorio-projetos-rotulo"
      disabled={disabled}
    />
  );
}
