/**
 * [COMPONENTE][VALIDACAO] Lista das regras da nova senha, marcadas enquanto o usuário digita.
 */

import React from "react";
import { Check, X } from "lucide-react";
import { passwordRules, passwordTooLong } from "../../autenticacao/senha.js";

// Lista flutuante das regras da nova senha. Fica sobre a tela (posição absoluta), então
// aparecer ou sumir não empurra os campos. Cada item é marcado conforme a senha é digitada.
export function RequisitosSenha({ id, value, visible }) {
  const tooLong = passwordTooLong(value);
  return (
    <div id={id} className="password-checklist" hidden={!visible}>
      <p className="password-checklist-title">A senha precisa ter:</p>
      <ul>
        {passwordRules.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.key} className={ok ? "ok" : ""}>
              {ok ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              <span>{rule.label}</span>
              <span className="visually-hidden">{ok ? " (atendido)" : " (pendente)"}</span>
            </li>
          );
        })}
        {tooLong && (
          <li className="error">
            <X size={16} aria-hidden="true" />
            <span>No máximo 72 bytes (acentos e emojis ocupam mais)</span>
          </li>
        )}
      </ul>
    </div>
  );
}
