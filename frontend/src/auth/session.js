/**
 * [SEGURANCA] Funções da sessão no navegador: apagar o token e revogar a sessão na API (POST
 * /auth/logout).
 */

// Apaga o token só se ainda for o mesmo (um login novo em outra ação não é apagado).
export function clearSession(token) {
  if (sessionStorage.getItem("authToken") !== token) return false;
  sessionStorage.removeItem("authToken");
  return true;
}

// [SEGURANCA] Revoga na API e, se der certo, limpa a sessão local.
export async function revokeSession(api, onSignedOut, onFailure) {
  const token = sessionStorage.getItem("authToken");
  if (!token) return onSignedOut();
  try {
    await api.post("/auth/logout", null, { headers: { Authorization: `Bearer ${token}` } });
    if (clearSession(token)) onSignedOut();
  } catch (error) {
    // Um erro/resposta da sessão antiga não pode afetar o login novo.
    if (sessionStorage.getItem("authToken") === token) onFailure(error);
  }
}
