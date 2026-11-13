import React, { useState } from "react";
import { Link } from "react-router-dom";
import { DatabaseZap } from "lucide-react";
import { api } from "../api/client.js";
import { ThemeToggle } from "../ThemeContext.jsx";
import { FontSizeControl } from "../components/FontSizeControl.jsx";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O usuário informa o e-mail e recebe um link de uso único para a tela de redefinição.
// A resposta é a mesma para e-mails cadastrados ou não.
export function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const value = email.trim();
    if (!value) {
      setError("Informe o e-mail.");
      return;
    }
    if (!EMAIL.test(value)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/esqueci-senha", { email: value });
      setMessage(data.message);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(
        data?.errors?.[0]?.message ||
          data?.message ||
          "Não foi possível conectar ao servidor. Tente novamente.",
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
        <h1>Esqueci minha senha</h1>
        <div className="login-help" role="note">
          <p>
            Informe o e-mail da sua conta. Se ele estiver cadastrado, você receberá um link para
            escolher uma nova senha.
          </p>
          <p>O link vale por 30 minutos e só pode ser usado uma vez.</p>
        </div>
        {message ? (
          <div className="feedback success" role="status">
            {message}
          </div>
        ) : (
          <form onSubmit={submit} className="login-form" noValidate>
            <label htmlFor="email-recuperacao">E-mail</label>
            <input
              id="email-recuperacao"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              autoFocus
            />
            {error && (
              <div className="feedback error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Enviando…" : "Enviar link"}
            </button>
          </form>
        )}
        <Link className="login-link" to="/login">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
