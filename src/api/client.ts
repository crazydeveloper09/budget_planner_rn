import axios from "axios";
import { getApiBaseUrl } from "./config";

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 12000,
});

export function setAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message.length > 0) return message;
    if (!error.response) return "Brak połączenia z serwerem. Uruchom API i MongoDB.";
  }
  return fallback;
}
