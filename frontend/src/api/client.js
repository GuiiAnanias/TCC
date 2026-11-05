import axios from "axios";
import { clearSession } from "../auth/session.js";

export const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || "http://localhost:3333/api",
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("authToken");
  if (token && config.url !== "/auth/login" && !config.headers.Authorization)
    config.headers.Authorization = `Bearer ${token}`;
  return config;
});
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
