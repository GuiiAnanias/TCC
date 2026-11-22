/**
 * [COMPONENTE] Caixa de texto que cresce com o conteúdo enquanto a pessoa digita, até um
 * limite de altura (depois disso, rola). Usada nos formulários de criação e edição.
 */

import React, { useLayoutEffect, useRef } from "react";

export function TextoAutoAjustavel({ value, alturaMaxima = 320, ...props }) {
  const ref = useRef(null);

  // Recalcula a altura a cada mudança de valor (digitação, edição carregada, formulário limpo).
  useLayoutEffect(() => {
    const caixa = ref.current;
    if (!caixa) return;
    caixa.style.height = "auto";
    const altura = Math.min(caixa.scrollHeight + 2, alturaMaxima);
    caixa.style.height = `${altura}px`;
    caixa.style.overflowY = caixa.scrollHeight + 2 > alturaMaxima ? "auto" : "hidden";
  }, [value, alturaMaxima]);

  return <textarea ref={ref} rows={1} value={value} {...props} />;
}
