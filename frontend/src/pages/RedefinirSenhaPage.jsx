import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DatabaseZap } from "lucide-react";
import { api } from "../api/client.js";
import { ThemeToggle } from "../ThemeContext.jsx";

// Tela aberta pelo link gerado com `corepack pnpm run senha:link <usuário>` no backend.
export function RedefinirSenhaPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (senha !== confirmacao) {
      setError("As duas senhas não são iguais.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/redefinir-senha", { token, novaSenha: senha });
      setDone(true);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(data?.errors?.[0]?.message || data?.message || "Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><section className="login-card">
    <div className="login-brand-row"><div className="brand"><DatabaseZap size={32} /><div><strong>CODE BI</strong><span>Gestão de projetos</span></div></div><ThemeToggle /></div>
    <h1>Redefinir senha</h1>
    {!token && <div className="feedback error" role="alert">Link inválido. Peça um novo link ao administrador do sistema.</div>}
    {token && done && <div className="feedback success" role="status">Senha redefinida. Entre com a nova senha.</div>}
    {token && !done && <>
      <p>Escolha uma nova senha com pelo menos 8 caracteres.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="nova-senha">Nova senha</label>
        <input id="nova-senha" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={senha} onChange={(event) => setSenha(event.target.value)} disabled={busy} autoFocus />
        <label htmlFor="confirmar-senha">Confirmar nova senha</label>
        <input id="confirmar-senha" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} disabled={busy} />
        {error && <div className="feedback error" role="alert">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Salvando…" : "Redefinir senha"}</button>
      </form>
    </>}
    <Link className="login-link" to="/login">{done ? "Ir para o login" : "Voltar para o login"}</Link>
  </section></main>;
}
