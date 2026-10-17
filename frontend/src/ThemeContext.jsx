import React, { createContext, useContext, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
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

    if (!document.startViewTransition || !document.documentElement.animate) {
      applyTheme();
      return;
    }

    // O centro do botão também funciona para ativação pelo teclado.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    transitionRunning.current = true;
    setChanging(true);
    let animation;
    let transition;
    try {
      transition = document.startViewTransition(applyTheme);
      const finished = transition.finished.catch(() => {});
      await transition.ready;
      animation = document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 440, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
      );
      await animation.finished;
      animation.cancel();
      // Libera as imagens da transição assim que o círculo cobre a tela.
      transition.skipTransition();
      await finished;
    } catch {
      transition?.skipTransition();
      applyTheme();
    } finally {
      animation?.cancel();
      transitionRunning.current = false;
      setChanging(false);
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme, changing }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle({ showLabel = false }) {
  const { theme, toggleTheme, changing } = useContext(ThemeContext);
  const dark = theme === "dark";
  return (
    <button className={`icon-button theme-toggle${showLabel ? " has-label" : ""}`} type="button" onClick={toggleTheme}
      disabled={changing} aria-busy={changing}
      title={dark ? "Ativar modo claro" : "Ativar modo noturno"}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo noturno"}>
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      {showLabel && <span>{dark ? "Claro" : "Escuro"}</span>}
    </button>
  );
}
