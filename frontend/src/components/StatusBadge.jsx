import React from "react";
import { projectStatusLabel } from "../config/projectOptions.js";

export function StatusBadge({ status }) {
  if (!status) return null;

  const statusClass = status.toString().toLowerCase();

  return <span className={`status status-${statusClass}`}>{projectStatusLabel(status)}</span>;
}
