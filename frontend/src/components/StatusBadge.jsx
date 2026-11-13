/**
 * [COMPONENTE] Selo de status (Ativo, Pendente, Faturado...) com ponto de cor e nome escrito; a cor
 * não é a única pista.
 */

import React from "react";
import { entryStatusLabel, projectStatusLabel } from "../config/projectOptions.js";

export function StatusBadge({ status }) {
  if (!status) return null;

  const statusClass = status.toString().toLowerCase();

  // Serve para status de cadastro/projeto e de apontamento; os nomes não se repetem.
  const name = entryStatusLabel(projectStatusLabel(status));
  // Status sem rótulo próprio (como INATIVO dos cadastros) aparecem como "Inativo".
  const label = /^[A-Z_]+$/.test(name)
    ? name.charAt(0) + name.slice(1).toLocaleLowerCase("pt-BR").replaceAll("_", " ")
    : name;

  return <span className={`status status-${statusClass}`}>{label}</span>;
}
