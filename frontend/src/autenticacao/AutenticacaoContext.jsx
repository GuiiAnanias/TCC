/**
 * [SEGURANCA][ESTADO] Sessão do usuário no front: login, restauração ao recarregar a página (GET
 * /auth/me) e logout. O token fica no sessionStorage (só na aba atual).
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/conexao.js";
import { revokeSession } from "./sessao.js";

const AutenticacaoContext = createContext(null);
export function AutenticacaoProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  // [SEGURANCA] Sair: revoga a sessão na API e limpa o token.
  function logout() {
    return revokeSession(
      api,
      () => {
        setUser(null);
        setError("");
        setSessionMessage("");
      },
      () => setError("Não foi possível encerrar a sessão no servidor. Tente novamente."),
    );
  }
  // [SEGURANCA] Ao abrir ou recarregar: confere o token salvo na API; inválido ou vencido volta
  // para o login.
  async function restore(signal) {
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("authToken");
      if (token) {
        const { data } = await api.get("/auth/me", { signal });
        if (sessionStorage.getItem("authToken") === token) setUser(data.user);
      }
    } catch (error) {
      if (!signal?.aborted && error.response?.status !== 401)
        setError("Não foi possível verificar sua sessão. Tente novamente.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    const expired = () => {
      setUser(null);
      setError("");
      setSessionMessage("Sua sessão expirou ou foi encerrada. Entre novamente.");
    };
    window.addEventListener("auth-expired", expired);
    restore(controller.signal);
    return () => {
      controller.abort();
      window.removeEventListener("auth-expired", expired);
    };
  }, []);
  // [REQUISICAO] POST /auth/login; guarda o token e o usuário.
  async function login(login, senha) {
    const { data } = await api.post("/auth/login", { login, senha });
    sessionStorage.setItem("authToken", data.token);
    setUser(data.user);
    setError("");
    setSessionMessage("");
  }
  return (
    <AutenticacaoContext.Provider
      value={{ user, loading, error, sessionMessage, restore, login, logout }}
    >
      {children}
    </AutenticacaoContext.Provider>
  );
}
// Atalho para as telas usarem o login (useAutenticacao().user, .login, .logout).
export const useAutenticacao = () => useContext(AutenticacaoContext);
