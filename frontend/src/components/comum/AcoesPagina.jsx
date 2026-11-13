/**
 * [COMPONENTE] Botão Atualizar de cada tela, levado para a barra superior do layout.
 */

import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";

/** Espaço da barra superior onde cada página coloca as próprias ações. */
export const EspacoAcoesPagina = createContext(null);

/**
 * Botão Atualizar da página. Dentro do layout autenticado vai para a barra superior, ao lado do
 * tamanho do texto e do tema; fora dele (testes, telas isoladas) aparece no próprio cabeçalho.
 */
export function AcoesPagina({ onRefresh, loading }) {
  const slot = useContext(EspacoAcoesPagina);
  const button = (
    <button
      className="secondary-button page-refresh"
      type="button"
      onClick={onRefresh}
      disabled={loading}
      title="Atualizar"
      aria-label="Atualizar"
    >
      <RefreshCw size={16} aria-hidden="true" />
      <span>Atualizar</span>
    </button>
  );
  if (slot) return createPortal(button, slot);
  return (
    <div className="page-actions-inline" role="group" aria-label="Ações da página">
      {button}
    </div>
  );
}
