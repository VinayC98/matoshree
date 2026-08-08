import api from "./axios";

export async function getDashboard() {
  const res = await api.get("/admin/dashboard");
  return res.data;
}
