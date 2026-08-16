import api from "./axios";

export type LoginPayload = {
  email: string;
  password: string;
};

export async function login(payload: LoginPayload) {
  const res = await api.post("/auth/login", payload);
  return res.data;
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  registrationCode: string;
}) {
  const res = await api.post("/auth/register", payload);
  return res.data;
}
