/**
 * Centralized payment-related types
 * Keeps API + UI perfectly in sync
 */
export type PaymentMode = "CASH" | "UPI" | "CARD";
export interface PaymentListResponse {
  data: {
    id: string;
    amount: number;
    paymentType: string;
    paymentMode: string;
    paidOn: string;
    student: {
      name: string;
      mobile: string;
    };
    membership: {
      startDate: string;
      endDate: string;
      priceSnapshot: number;
    };
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
