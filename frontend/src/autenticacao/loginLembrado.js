/**
 * [SEGURANCA] "Lembrar meu usuário" do login: guarda só o usuário ou e-mail no navegador
 * (localStorage), nunca a senha nem a sessão.
 */

const STORAGE_KEY = "code-bi-remembered-login";

function validLogin(value) {
  return typeof value === "string" && value.trim().length <= 254 ? value.trim() : "";
}

// Lê o usuário lembrado; sem armazenamento disponível, volta vazio.
export function readRememberedLogin() {
  try {
    return validLogin(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "";
  }
}

// A preferência só contém o identificador. Senha e sessão não fazem parte dela.
export function saveRememberedLogin(login) {
  try {
    const value = validLogin(login);
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Bloqueio/quota do armazenamento não pode impedir a autenticação.
  }
}

// Apaga o usuário lembrado (checkbox desmarcado).
export function forgetRememberedLogin() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // O login continua disponível quando o navegador bloqueia o armazenamento.
  }
}
