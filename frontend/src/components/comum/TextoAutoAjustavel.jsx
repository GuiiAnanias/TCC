/**
 * [COMPONENTE] Caixa de texto que cresce com o conteúdo enquanto a pessoa digita, até um
 * limite de altura (depois disso, rola). Usada nos formulários de criação e edição.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export function TextoAutoAjustavel({ value, alturaMaxima = 320, ...props }) {
  const ref = useRef(null);

  const ajustar = useCallback(() => {
    const caixa = ref.current;
    if (!caixa) return;
    caixa.style.height = "auto";
    // As bordas ficam fora do scrollHeight; a espessura real varia com a escala da tela.
    const estilo = getComputedStyle(caixa);
    const bordas = parseFloat(estilo.borderTopWidth) + parseFloat(estilo.borderBottomWidth) || 0;
    const conteudo = caixa.scrollHeight + bordas;
    caixa.style.height = `${Math.min(conteudo, alturaMaxima)}px`;
    caixa.style.overflowY = conteudo > alturaMaxima ? "auto" : "hidden";
  }, [alturaMaxima]);

  // Recalcula a altura a cada mudança de valor (digitação, edição carregada, formulário limpo).
  useLayoutEffect(ajustar, [value, ajustar]);

  // A largura muda o número de linhas (janela redimensionada, menu lateral recolhido).
  useEffect(() => {
    const caixa = ref.current;
    if (!caixa || typeof ResizeObserver === "undefined") return undefined;
    let largura = caixa.clientWidth;
    const observador = new ResizeObserver(() => {
      if (caixa.clientWidth === largura) return;
      largura = caixa.clientWidth;
      ajustar();
    });
    observador.observe(caixa);
    return () => observador.disconnect();
  }, [ajustar]);

  return <textarea ref={ref} rows={1} value={value} {...props} />;
}
