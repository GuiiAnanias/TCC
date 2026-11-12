import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { DatabaseZap } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { ThemeToggle } from "../ThemeContext.jsx";
import { FontSizeControl } from "../components/FontSizeControl.jsx";
import {
  readRememberedLogin,
  saveRememberedLogin,
  forgetRememberedLogin,
} from "../auth/rememberedLogin.js";

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [initialLogin] = useState(readRememberedLogin);
  const [login, setLogin] = useState(initialLogin);
  const [rememberUser, setRememberUser] = useState(Boolean(initialLogin));
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = location.state?.from;
  const destination =
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !from.startsWith("/login")
      ? from
      : "/dashboard";
  if (auth.user) return <Navigate to={destination} replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await auth.login(login, senha);
      if (rememberUser) saveRememberedLogin(login);
    } catch (error) {
      setError(
        error.response?.data?.message || "Não foi possível conectar ao servidor. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand-row">
          <div className="brand">
            <DatabaseZap size={32} />
            <div>
              <strong>CODE BI</strong>
              <span>Gestão de projetos</span>
            </div>
          </div>
          <div className="login-controls">
            <FontSizeControl />
            <ThemeToggle />
          </div>
        </div>
        <h1>Entrar no sistema</h1>
        <p>Use sua conta para acessar os projetos e indicadores.</p>
        {auth.sessionMessage && <p role="status">{auth.sessionMessage}</p>}
        {!auth.sessionMessage && typeof location.state?.aviso === "string" && (
          <p className="feedback success" role="status">
            {location.state.aviso}
          </p>
        )}
        <form onSubmit={submit} className="login-form">
          <label htmlFor="login">Usuário ou e-mail</label>
          <input
            id="login"
            autoComplete="username"
            required
            maxLength={254}
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            disabled={busy}
            autoFocus
          />
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            disabled={busy}
          />
          <div className="login-remember">
            <label htmlFor="remember-user">
              <input
                id="remember-user"
                type="checkbox"
                checked={rememberUser}
                disabled={busy}
                aria-describedby="remember-user-help"
                onChange={(event) => {
                  const checked = event.target.checked;
                  setRememberUser(checked);
                  if (!checked) forgetRememberedLogin();
                }}
              />
              Lembrar meu usuário neste navegador
            </label>
            <small id="remember-user-help">
              Preenche apenas o usuário ou e-mail no próximo acesso.
            </small>
          </div>
          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <Link className="login-link" to="/esqueci-senha">
          Esqueci minha senha
        </Link>
      </section>
    </main>
  );
}
