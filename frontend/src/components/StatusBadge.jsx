import React from "react";
import { entryStatusLabel, projectStatusLabel } from "../config/projectOptions.js";

export function StatusBadge({ status }) {
  if (!status) return null;

  const statusClass = status.toString().toLowerCase();

  // Serve para status de cadastro/projeto e de apontamento; os nomes não se repetem.
  const label = entryStatusLabel(projectStatusLabel(status));

  return <span className={`status status-${statusClass}`}>{label}</span>;
}
