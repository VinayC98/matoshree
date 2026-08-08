import api from "./axios";

export async function getSeatMap(params: { date: string; shiftId: string }) {
  const res = await api.get("/allocations/seat-map", { params });
  return res.data;
}

export async function assignSeat(payload: {
  studentId: string;
  seatId: string;
  shiftId: string;
  date: string;
}) {
  return api.post("/allocations/assign", payload);
}

export async function unassignSeat(payload: { allocationId: string }) {
  return api.post("/allocations/unassign", payload);
}

// export async function swapSeat(payload: {
//   fromAllocationId: string;
//   toSeatId: string;
// }) {
//   return api.post("/allocations/swap", payload);
// }

export const swapDailySeat = (payload: {
  date: string;
  shiftId: string;
  seatIdA: string;
  seatIdB: string;
}) => api.post("/allocations/swap-daily", payload);

export const swapFixedSeat = (payload: {
  studentId: string;
  newSeatId: string;
}) => api.post("/memberships/swap-fixed", payload);
