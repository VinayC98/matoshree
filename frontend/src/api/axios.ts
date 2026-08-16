import axios from "axios";

import { clearToken, getToken } from "./auth.store";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Attach JWT token to requests when available.
 */
api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Global authentication error handling.
 *
 * Login and registration are public authentication endpoints.
 * A 401 from either endpoint must be returned to the caller so
 * the page can display the actual API error instead of redirecting.
 *
 * For protected endpoints, a 401 means the current token is
 * invalid/expired, so clear it and return the user to login.
 */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const requestUrl = error.config?.url ?? "";

    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register");

    if (status === 401 && !isAuthRequest) {
      clearToken();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
