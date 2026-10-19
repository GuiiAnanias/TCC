import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";

export function HelpDialog({ title, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  function closeOnBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current.close();
  }
  return <>
    <button type="button" className="icon-button dashboard-help-trigger" aria-label={title} aria-haspopup="dialog" title={title} onClick={() => dialog.current.showModal()}><CircleHelp size={22} aria-hidden="true" /></button>
    {createPortal(<dialog ref={dialog} className="dashboard-help-dialog" aria-labelledby={titleId} onClick={closeOnBackdrop}>
      <header className="dashboard-help-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Fechar ajuda" title="Fechar ajuda" autoFocus onClick={() => dialog.current.close()}><X size={20} aria-hidden="true" /></button></header>
      <div className="dashboard-help-content">{children}</div>
    </dialog>, document.body)}
  </>;
}
