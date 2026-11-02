import React from "react";

export function StatusBadge({ status }) {
  if (!status) return null;

  const statusClass = status.toString().toLowerCase();

  return <span className={`status status-${statusClass}`}>{status}</span>;
}
