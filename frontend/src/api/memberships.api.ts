import api from "./axios";

export async function getMembershipPlans() {
  const res = await api.get("/config/membership-plans");
  return res.data;
}

export async function getShifts() {
  const res = await api.get("/config/shifts");
  return res.data;
}

export async function getPricePreview(params: {
  planId: string;
  shiftId: string;
}) {
  const res = await api.get("/config/pricing/preview", {
    params,
  });
  return res.data;
}
export async function createMembership(payload: {
  studentId: string;
  membershipPlanId: string;
  shiftId: string;
  startDate: string; // ISO string
}) {
  const res = await api.post("/memberships", payload);
  return res.data;
}
