import axios from "./axios";
import type { PaymentListResponse } from "../types/payments";

/* =======================
   TYPES
======================= */

export type PaymentMode = "CASH" | "UPI" | "CARD";

export type PaymentType = "REGISTRATION" | "MONTHLY" | "ADVANCE" | "PARTIAL";

/* =======================
   REQUEST PAYLOAD
======================= */

export type CreatePaymentPayload = {
  membershipId: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentType: PaymentType;
  extendMembership?: boolean;
  extendMonths?: number;
};

type PaymentFilters = {
  paymentType?: string;
};

/* =======================
   API CALL
======================= */

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
