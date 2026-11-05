export function clearSession(token) {
  if (sessionStorage.getItem("authToken") !== token) return false;
  sessionStorage.removeItem("authToken");
  return true;
}

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
