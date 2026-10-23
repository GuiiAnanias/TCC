import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { DatabaseZap } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { ThemeToggle } from "../ThemeContext.jsx";

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = location.state?.from;
  const destination = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/login") ? from : "/dashboard";
  if (auth.user) return <Navigate to={destination} replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await auth.login(login, senha); }
    catch (error) { setError(error.response?.data?.message || "Não foi possível conectar ao servidor. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-card">
    <div className="login-brand-row"><div className="brand"><DatabaseZap size={32} /><div><strong>CODE BI</strong><span>Gestão de projetos</span></div></div><ThemeToggle /></div>
    <h1>Entrar no sistema</h1><p>Use sua conta para acessar os projetos e indicadores.</p>
    <form onSubmit={submit} className="login-form">
      <label htmlFor="login">Usuário ou e-mail</label><input id="login" autoComplete="username" required maxLength={254} value={login} onChange={(event) => setLogin(event.target.value)} disabled={busy} autoFocus />
      <label htmlFor="senha">Senha</label><input id="senha" type="password" autoComplete="current-password" required maxLength={256} value={senha} onChange={(event) => setSenha(event.target.value)} disabled={busy} />
      {error && <div className="feedback error" role="alert">{error}</div>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  </section></main>;
}
