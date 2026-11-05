import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client.js";
import { revokeSession } from "./session.js";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
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
  async function login(login, senha) {
    const { data } = await api.post("/auth/login", { login, senha });
    sessionStorage.setItem("authToken", data.token);
    setUser(data.user);
    setError("");
    setSessionMessage("");
  }
  return (
    <AuthContext.Provider value={{ user, loading, error, sessionMessage, restore, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
