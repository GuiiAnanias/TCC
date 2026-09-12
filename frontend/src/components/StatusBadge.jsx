import React from "react";

export function StatusBadge({ status }) {
  const normalizedStatus = status || "ATIVO";

  return (
    <span className={`status status-${normalizedStatus.toLowerCase()}`}>
      {normalizedStatus === "ATIVO" ? "Ativo" : "Inativo"}
    </span>
  );
}
