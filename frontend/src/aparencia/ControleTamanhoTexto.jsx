/**
 * [COMPONENTE][ACESSIBILIDADE] Botão Aa: escolhe o tamanho do texto (100%, 112,5% ou 125%) e salva
 * no navegador.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";

const STORAGE_KEY = "code-bi-font-size";

/** Tamanhos oferecidos pelo botão Aa; o valor vai para html[data-font-size] (ver styles.css). */
export const FONT_SIZES = [
  { value: "padrao", label: "Padrão", percent: 100 },
  { value: "grande", label: "Grande", percent: 112.5 },
  { value: "maior", label: "Muito grande", percent: 125 },
];

// [ESTADO] Tamanho salvo no navegador; valor desconhecido volta ao padrão.
export function readFontSize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return FONT_SIZES.some((size) => size.value === saved) ? saved : "padrao";
  } catch {
    return "padrao";
  }
}

// [ESTADO] Aplica em html[data-font-size] (o styles.css aumenta o rem) e salva a escolha.
export function applyFontSize(value) {
  const size = FONT_SIZES.some((option) => option.value === value) ? value : "padrao";
  if (size === "padrao") delete document.documentElement.dataset.fontSize;
  else document.documentElement.dataset.fontSize = size;
  try {
    if (size === "padrao") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Sem armazenamento, o tamanho vale até fechar a aba.
  }
  return size;
}

/**
 * Botão Aa: abre a escolha do tamanho do texto da interface. O texto e os controles crescem
 * juntos (tudo em rem) e as colunas se reorganizam, sem rolagem lateral.
 */
export function ControleTamanhoTexto() {
  const [size, setSize] = useState(readFontSize);
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const options = useRef([]);
  const menuId = useId();
  const current = FONT_SIZES.find((option) => option.value === size);

  useEffect(() => {
    if (!open) return undefined;
    options.current[FONT_SIZES.findIndex((option) => option.value === size)]?.focus();
    const closeOutside = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open, size]);

  function choose(value) {
    setSize(applyFontSize(value));
    setOpen(false);
    trigger.current?.focus();
  }

  // [ACESSIBILIDADE] Teclado: setas navegam, Home/End vão às pontas e Esc fecha.
  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = options.current.indexOf(document.activeElement);
    const last = FONT_SIZES.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowDown"
            ? index >= last
              ? 0
              : index + 1
            : index <= 0
              ? last
              : index - 1;
    options.current[next]?.focus();
  }

  return (
    <div className="font-size-control" ref={wrapper} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        className="icon-button toolbar-button font-size-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Tamanho do texto: ${current.label}`}
        title="Tamanho do texto"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">Aa</span>
      </button>
      {open && (
        <div className="font-size-menu" id={menuId} role="menu" aria-label="Tamanho do texto">
          {FONT_SIZES.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                options.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === size}
              className="font-size-option"
              onClick={() => choose(option.value)}
            >
              <span className="font-size-sample" style={{ fontSize: `${option.percent}%` }}>
                Aa
              </span>
              <span className="font-size-name">{option.label}</span>
              <span className="font-size-percent">{option.percent.toLocaleString("pt-BR")}%</span>
              {option.value === size && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
