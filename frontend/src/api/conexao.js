/**
 * [REQUISICAO] Cliente HTTP (axios) usado por todas as telas para falar com a API (VITE_API_URL ou
 * http://localhost:3333/api).
 */

import axios from "axios";
import { clearSession } from "../autenticacao/sessao.js";

export const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || "http://localhost:3333/api",
});

// [SEGURANCA] Antes de cada requisição: envia o token da sessão no cabeçalho Authorization: Bearer.
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("authToken");
  if (token && config.url !== "/auth/login" && !config.headers.Authorization)
    config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// [SEGURANCA][ERRO] Resposta 401 com o token atual: limpa a sessão e avisa o AutenticacaoContext (evento
// auth-expired), que volta para o login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url !== "/auth/login") {
      const token = sessionStorage.getItem("authToken");
      if (token && error.config?.headers?.Authorization === `Bearer ${token}`) {
        clearSession(token);
        window.dispatchEvent(new Event("auth-expired"));
      }
    }
    return Promise.reject(error);
  },
);
