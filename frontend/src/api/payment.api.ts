import axios from "./axios";
import type { PaymentListResponse } from "../types/payments";

export type PaymentMode = "CASH" | "UPI" | "CARD";

export type CreatePaymentPayload = {
  membershipId: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentType: "REGISTRATION" | "PARTIAL";
};

export type PaymentAllocation = {
  id: string;
  amount: number;
  charge: {
    id: string;
    type: string;
    amountDue: number;
    periodStart: string | null;
    periodEnd: string | null;
    status: string;
  };
};

export type PaymentRecord = {
  id: string;
  membershipId: string;
  studentId: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  paidOn: string;
  student?: {
    id: string;
    name: string;
    mobile: string;
  };
  membership?: {
    id: string;
    startDate: string;
    endDate: string;
    membershipPlan?: {
      name: string;
    };
    shift?: {
      name: string;
    };
    fixedSeat?: {
      seatNumber: number;
      lab: {
        name: string;
      };
    } | null;
  };
  allocations?: PaymentAllocation[];
};

export type MembershipCharge = {
  id: string;
  type: "REGISTRATION" | "MEMBERSHIP";
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  allocations: {
    id: string;
    amount: number;
    payment: {
      id: string;
      amount: number;
      paymentMode: string;
      paymentType: string;
      paidOn: string;
    };
  }[];
};

export type MembershipAccountResponse = {
  membership: {
    id: string;
    isActive: boolean;
    startDate: string;
    endDate: string;
    priceSnapshot: number;
    registrationFee: number;
    student: {
      id: string;
      name: string;
      mobile: string;
    };
    plan: {
      id: string;
      code: string;
      name: string;
    };
    shift: {
      id: string;
      code: string;
      name: string;
    };
    fixedSeat: {
      seatNumber: number;
      lab: {
        name: string;
      };
    } | null;
  };

  account: {
    totalDue: number;
    totalPaid: number;
    outstanding: number;
    status: "YET_TO_PAY" | "PARTIAL" | "PAID";
  };

  charges: MembershipCharge[];

  payments: {
    id: string;
    amount: number;
    paymentMode: string;
    paymentType: string;
    paidOn: string;
    allocatedAmount: number;
  }[];
};

type PaymentFilters = {
  paymentType?: string;
};

export const createPayment = async (payload: CreatePaymentPayload) => {
  const res = await axios.post("/payments", payload);
  return res.data;
};

export const getPayments = async (
  page: number,
  limit: number,
  filters?: PaymentFilters,
): Promise<PaymentListResponse> => {
  const res = await axios.get("/payments", {
    params: {
      page,
      limit,
      ...filters,
    },
  });

  return res.data;
};

export const getMembershipAccount = async (
  membershipId: string,
): Promise<MembershipAccountResponse> => {
  if (!membershipId) {
    throw new Error("Membership ID is required");
  }

  const res = await axios.get(`/memberships/${membershipId}/account`);

  return res.data;
};
