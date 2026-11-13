/**
 * [TELA][SEGURANCA] Redefinição de senha pelo link do e-mail (/redefinir-senha?token=...). Mostra
 * "Senha atualizada com sucesso" e volta ao login.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DatabaseZap } from "lucide-react";
import { api } from "../api/conexao.js";
import { BotaoTema } from "../aparencia/TemaContext.jsx";
import { ControleTamanhoTexto } from "../aparencia/ControleTamanhoTexto.jsx";
import { newPasswordError } from "../autenticacao/senha.js";
import { RequisitosSenha } from "../components/comum/RequisitosSenha.jsx";

const LINK_INVALIDO = "Este link já foi usado, expirou ou não é válido.";
export const SENHA_ATUALIZADA = "Senha atualizada com sucesso";
// Tempo para ler a confirmação antes de voltar ao login.
const ESPERA_LOGIN = 3000;

// Tela aberta pelo link recebido por e-mail ("Esqueci minha senha") ou gerado no servidor
// com `corepack pnpm run senha:link <usuário>`. O link é conferido assim que a tela abre:
// se não puder mais ser usado, a tela avisa e não mostra o formulário.
export function RedefinirSenhaPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  // verificando | valido | invalido | falha
  const [link, setLink] = useState(token ? "verificando" : "invalido");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();

  // Depois de atualizar a senha, volta sozinha ao login, que repete a confirmação.
  useEffect(() => {
    if (!done) return undefined;
    const espera = setTimeout(
      () =>
        navigate("/login", {
          replace: true,
          state: { aviso: `${SENHA_ATUALIZADA}. Entre com a nova senha.` },
        }),
      ESPERA_LOGIN,
    );
    return () => clearTimeout(espera);
  }, [done, navigate]);

  // [REQUISICAO] Ao abrir: confere o link (POST /auth/redefinir-senha/validar); vencido ou usado
  // mostra o aviso sem o formulário.
  const verificar = useCallback(
    async (isCurrent = () => true) => {
      if (!token) return setLink("invalido");
      setLink("verificando");
      try {
        await api.post("/auth/redefinir-senha/validar", { token });
        if (isCurrent()) setLink("valido");
      } catch (requestError) {
        if (isCurrent()) setLink(requestError.response?.status === 400 ? "invalido" : "falha");
      }
    },
    [token],
  );

  useEffect(() => {
    let current = true;
    verificar(() => current);
    return () => {
      current = false;
    };
  }, [verificar]);

  // [VALIDACAO][REQUISICAO] Confere as regras da senha e se as duas senhas são iguais; envia para
  // POST /auth/redefinir-senha.
  async function submit(event) {
    event.preventDefault();
    setError("");
    const passwordError = newPasswordError(senha);
    if (passwordError) {
      setError(passwordError);
      return;
    }
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
      // O link pode ter expirado enquanto a pessoa preenchia o formulário.
      if (requestError.response?.status === 400 && !data?.errors) setLink("invalido");
      else
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
            <ControleTamanhoTexto />
            <BotaoTema />
          </div>
        </div>
        <h1>Redefinir senha</h1>
        {link === "verificando" && (
          <p role="status" aria-live="polite">
            Verificando o link…
          </p>
        )}
        {link === "invalido" && (
          <div className="feedback error" role="alert">
            {LINK_INVALIDO} <Link to="/esqueci-senha">Solicite um novo link</Link>.
          </div>
        )}
        {link === "falha" && (
          <>
            <div className="feedback error" role="alert">
              Não foi possível verificar o link. Confira a conexão e tente novamente.
            </div>
            <button className="primary-button" type="button" onClick={() => verificar()}>
              Tentar novamente
            </button>
          </>
        )}
        {link === "valido" && done && (
          <div className="feedback success" role="status">
            {SENHA_ATUALIZADA}. Você será levado ao login para entrar com a nova senha.
          </div>
        )}
        {link === "valido" && !done && (
          <>
            <p>
              Escolha uma nova senha. Ao clicar no campo, as regras aparecem e vão sendo marcadas
              conforme você digita.
            </p>
            <form onSubmit={submit} className="login-form">
              <label htmlFor="nova-senha">Nova senha</label>
              <div className="password-field">
                <input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  onFocus={() => setShowRules(true)}
                  onBlur={() => setShowRules(false)}
                  aria-describedby="regras-senha"
                  disabled={busy}
                />
                <RequisitosSenha id="regras-senha" value={senha} visible={showRules} />
              </div>
              <label htmlFor="confirmar-senha">Confirmar nova senha</label>
              <input
                id="confirmar-senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                disabled={busy}
              />
              {error && (
                <div className="feedback error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Redefinir senha"}
              </button>
            </form>
          </>
        )}
        <Link className="login-link" to="/login">
          {done ? "Ir para o login" : "Voltar para o login"}
        </Link>
      </section>
    </main>
  );
}
