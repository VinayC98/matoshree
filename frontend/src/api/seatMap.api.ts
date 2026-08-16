import api from "./axios";

export type SeatMapParams = {
  date: string;
  shiftId: string;
};

export type AssignSeatPayload = {
  studentId: string;
  seatId: string;
  shiftId: string;
  date: string;
};

export type UnassignSeatPayload = {
  allocationId: string;
};

export type SwapDailySeatPayload = {
  date: string;
  shiftId: string;
  seatIdA: string;
  seatIdB: string;
};

export type SwapFixedSeatPayload = {
  studentId: string;
  newSeatId: string;
};

export async function getSeatMap(params: SeatMapParams) {
  const res = await api.get("/allocations/seat-map", {
    params,
  });

  return res.data;
}

export async function assignSeat(payload: AssignSeatPayload) {
  const res = await api.post("/allocations/assign", payload);

  return res.data;
}

export async function unassignSeat(payload: UnassignSeatPayload) {
  const res = await api.post("/allocations/unassign", payload);

  return res.data;
}

export async function swapDailySeat(payload: SwapDailySeatPayload) {
  const res = await api.post("/allocations/swap-daily", payload);

  return res.data;
}

export async function swapFixedSeat(payload: SwapFixedSeatPayload) {
  const res = await api.post("/allocations/swap-fixed", payload);

  return res.data;
}
