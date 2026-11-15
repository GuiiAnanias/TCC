/**
 * [COMPONENTE] Controle de paginação reutilizável e hook usePaginacao para listas e tabelas
 * do sistema, limitando a exibição em 20 itens por página.
 */

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const ITENS_POR_PAGINA = 20;

export function usePaginacao(itens = [], porPagina = ITENS_POR_PAGINA) {
  const lista = useMemo(() => (Array.isArray(itens) ? itens : []), [itens]);
  const [paginaSolicitada, setPagina] = useState(1);

  const totalItens = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina));
  const pagina = Math.min(Math.max(1, paginaSolicitada), totalPaginas);

  const inicioIndice = (pagina - 1) * porPagina;
  const fimIndice = Math.min(inicioIndice + porPagina, totalItens);

  const itensPaginados = useMemo(
    () => lista.slice(inicioIndice, fimIndice),
    [lista, inicioIndice, fimIndice],
  );

  return {
    pagina,
    setPagina,
    porPagina,
    totalItens,
    totalPaginas,
    itensPaginados,
    inicio: totalItens ? inicioIndice + 1 : 0,
    fim: fimIndice,
  };
}

export function PaginacaoTabela({
  pagina,
  totalPaginas,
  totalItens,
  inicio,
  fim,
  onPageChange,
  rotulo = "Páginas da lista",
}) {
  if (!totalItens) return null;

  return (
    <nav className="report-history-pages table-pagination" aria-label={rotulo}>
      <span className="table-pagination-summary">
        Exibindo {inicio}–{fim} de {totalItens} {totalItens === 1 ? "item" : "itens"}
      </span>
      {totalPaginas > 1 && (
        <div className="table-pagination-controls">
          <button
            type="button"
            className="secondary-button"
            disabled={pagina <= 1}
            onClick={() => onPageChange(pagina - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Anterior
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={pagina >= totalPaginas}
            onClick={() => onPageChange(pagina + 1)}
          >
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
