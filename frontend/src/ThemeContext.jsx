import React, { createContext, useContext, useState } from "react";
import { Moon, Sun } from "lucide-react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      localStorage.setItem("code-bi-theme", nextTheme);
    } catch {
      // O tema continua funcionando quando o navegador bloqueia o armazenamento.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const dark = theme === "dark";
  const label = dark ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button
      className="icon-button toolbar-button theme-toggle"
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
