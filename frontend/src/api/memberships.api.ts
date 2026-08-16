import api from "./axios";

export type CreateMembershipPayload = {
  studentId: string;
  membershipPlanId: string;
  shiftId: string;
  fixedSeatId?: string;
  startDate: string;
  initialPaymentAmount?: number;
  paymentMode?: string;
};

export type CreateMembershipResponse = {
  message: string;
  membership: {
    id: string;
    studentId: string;
    membershipPlanId: string;
    shiftId: string;
    fixedSeatId: string | null;
    startDate: string;
    endDate: string;
    priceSnapshot: number;
    registrationFee: number;
    isActive: boolean;
  };
  payment: {
    id: string;
    membershipId: string;
    studentId: string;
    amount: number;
    paymentMode: string;
    paymentType: string;
    paidOn: string;
  } | null;
  paymentSummary: {
    totalDue: number;
    totalPaid: number;
    outstanding: number;
    status: "YET_TO_PAY" | "PARTIAL" | "PAID";
  };
};

export async function getMembershipPlans() {
  const res = await api.get("/config/membership-plans");
  return res.data;
}

export async function getShifts() {
  const res = await api.get("/config/shifts");
  return res.data;
}

export async function getPricePreview(payload: {
  planId: string;
  shiftId: string;
}) {
  const res = await api.get("/config/pricing/preview", {
    params: payload,
  });

  return res.data;
}

export async function createMembership(payload: {
  studentId: string;
  membershipPlanId: string;
  shiftId: string;
  startDate: string;
  fixedSeatId?: string;
  initialPaymentAmount?: number;
  paymentMode?: string;
}) {
  const res = await api.post("/memberships", payload);
  return res.data;
}

export async function renewMembership(payload: {
  studentId: string;
  paymentAmount?: number;
  paymentMode?: string;
}) {
  const res = await api.post("/memberships/renew", payload);
  return res.data;
}

export async function changeMembership(payload: {
  studentId: string;
  membershipPlanId: string;
  shiftId: string;
  startDate: string;
  fixedSeatId?: string;
  initialPaymentAmount?: number;
  paymentMode?: string;
}) {
  const res = await api.post("/memberships/change", payload);
  return res.data;
}

export async function getMembershipAccount(membershipId: string) {
  if (!membershipId) {
    throw new Error("Membership ID is required");
  }

  const res = await api.get(`/memberships/${membershipId}/account`);

  return res.data;
}
