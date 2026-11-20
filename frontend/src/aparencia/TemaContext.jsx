/**
 * [ESTADO] Tema claro/escuro. O tema fica em html[data-theme] (lido pelo styles.css) e é salvo no
 * navegador (code-bi-theme).
 */

import React, { createContext, useContext, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";

const TemaContext = createContext(null);

// [ACESSIBILIDADE] Respeita a opção do sistema de reduzir animações.
const prefereMenosMovimento = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// [ESTADO] Guarda o tema atual e a função de troca para toda a aplicação.
export function TemaProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const [changing, setChanging] = useState(false);
  const transitionRunning = useRef(false);

  async function toggleTheme(event) {
    if (transitionRunning.current) return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    function applyTheme() {
      flushSync(() => {
        document.documentElement.dataset.theme = nextTheme;
        setTheme(nextTheme);
      });
      try {
        localStorage.setItem("code-bi-theme", nextTheme);
      } catch {
        // O tema continua funcionando quando o navegador bloqueia o armazenamento.
      }
    }

    // Sem suporte à transição de tela (ou com movimento reduzido), o tema só troca.
    if (
      !document.startViewTransition ||
      !document.documentElement.animate ||
      !event?.currentTarget ||
      prefereMenosMovimento()
    ) {
      applyTheme();
      return;
    }

    // O novo tema se espalha em círculo a partir do centro do botão (também pelo teclado).
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    transitionRunning.current = true;
    setChanging(true);
    let animation;
    let transition;
    try {
      transition = document.startViewTransition(applyTheme);
      const finished = transition.finished.catch(() => {});
      // Se a aba não estiver desenhando (oculta, minimizada), a animação não começa: depois de
      // 1 s, desiste dela e troca o tema direto, para o botão nunca ficar travado.
      await Promise.race([
        transition.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error("sem quadros")), 1000)),
      ]);
      animation = document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 440, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
      );
      await animation.finished;
      animation.cancel();
      // Libera as imagens da transição assim que o círculo cobre a tela.
      transition.skipTransition();
      await finished;
    } catch {
      transition?.skipTransition();
      if (document.documentElement.dataset.theme !== nextTheme) applyTheme();
    } finally {
      animation?.cancel();
      transitionRunning.current = false;
      setChanging(false);
    }
  }

  return (
    <TemaContext.Provider value={{ theme, toggleTheme, changing }}>{children}</TemaContext.Provider>
  );
}

// [COMPONENTE] Botão de tema da barra superior e das telas de login.
export function BotaoTema() {
  const { theme, toggleTheme, changing } = useContext(TemaContext);
  const dark = theme === "dark";
  const label = dark ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button
      className="icon-button toolbar-button theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-busy={changing}
      title={label}
      aria-label={label}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
