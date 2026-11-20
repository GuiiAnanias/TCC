/**
 * [COMPONENTE] Modal de confirmação para ações de inativação, encerramento, arquivamento ou
 * exclusão, substituindo o window.confirm nativo do navegador.
 */

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

export function DialogoConfirmacao({
  open = true,
  title = "Confirmar ação",
  description,
  message,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  variant,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const text = description ?? message;
  const isDanger = variant ? variant === "danger" : danger;

  useEffect(() => {
    if (!open) return undefined;
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal?.();
    }
    return () => {
      if (element?.open) {
        element.close?.();
      }
    };
  }, [open]);

  if (!open) return null;

  function closeOnBackdrop(event) {
    if (busy || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      onCancel?.();
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="dashboard-help-dialog confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={text ? descriptionId : undefined}
      onClick={closeOnBackdrop}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel?.();
      }}
    >
      <header className="dashboard-help-header">
        <div className="confirm-dialog-title">
          <AlertTriangle
            size={20}
            aria-hidden="true"
            className={isDanger ? "confirm-icon-danger" : "confirm-icon-warning"}
          />
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar confirmação"
          title="Fechar confirmação"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="dashboard-help-content">
        {text && <p id={descriptionId}>{text}</p>}
        {children}
        <div className="actions-row">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onCancel}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDanger ? "primary-button danger-button" : "primary-button"}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
