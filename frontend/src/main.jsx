/**
 * [INICIO] Ponto de entrada do front (React + Vite): monta o App dentro do roteador e carrega o
 * styles.css. Rodar com `corepack pnpm run dev` na pasta frontend (http://localhost:5173).
 */

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
