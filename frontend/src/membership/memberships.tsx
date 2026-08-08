import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getMembershipPlans,
  getShifts,
  getPricePreview as previewPricing,
  createMembership,
} from "../api/memberships.api";
import { getStudents } from "../api/students.api";
import { getSeatMap } from "../api/seatMap.api";
import { toast } from "react-toastify";

/* =======================
   TYPES
======================= */

type SeatMapSeat = {
  seatId: string;
  seatNumber: number;
  status: "FREE" | "OCCUPIED" | "FIXED";
  student: any | null;
};

type SeatMapRow = {
  rowNumber: number;
  seats: SeatMapSeat[];
};

type SeatMapLab = {
  labId: string;
  labName: string;
  rows: SeatMapRow[];
};

/* =======================
   COMPONENT
======================= */

export default function Membership() {
  /* Form state */
  const [studentId, setStudentId] = useState("");
  const [membershipPlanId, setMembershipPlanId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [fixedSeatId, setFixedSeatId] = useState("");
  const [loadFixedSeats, setLoadFixedSeats] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  /* =======================
     BASE QUERIES
  ======================= */

  const studentsQuery = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  const plansQuery = useQuery({
    queryKey: ["membership-plans"],
    queryFn: getMembershipPlans,
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  /* =======================
     PLAN LOGIC
  ======================= */

  const selectedPlan = useMemo(() => {
    return plansQuery.data?.find((p: any) => p.id === membershipPlanId);
  }, [plansQuery.data, membershipPlanId]);

  const isFixedPlan =
    selectedPlan?.type === "FIXED" ||
    selectedPlan?.code?.toLowerCase().includes("fixed");

  /* Detect FULL-TIME shift (canonical for fixed seats) */
  const fullTimeShift = useMemo(() => {
    return shiftsQuery.data?.find(
      (s: any) =>
        s.code?.toLowerCase().includes("full") ||
        s.name?.toLowerCase().includes("full"),
    );
  }, [shiftsQuery.data]);

  const fullDayShift = useMemo(() => {
    return shiftsQuery.data?.find((s: any) => s.code === "FULL_DAY");
  }, [shiftsQuery.data]);

  useEffect(() => {
    if (isFixedPlan && fullDayShift?.id) {
      setShiftId(fullDayShift.id);
      setLoadFixedSeats(true);
    }

    if (!isFixedPlan) {
      setShiftId("");
      setLoadFixedSeats(false);
      setFixedSeatId("");
    }
  }, [isFixedPlan, fullDayShift]);

  /* Trigger fixed seat loading */
  <select
    className="border p-2 rounded w-full bg-white disabled:bg-gray-100"
    value={shiftId}
    onChange={(e) => setShiftId(e.target.value)}
    disabled={isFixedPlan}
  >
    <option value="">
      {isFixedPlan ? "FULL DAY (Fixed)" : "Select Shift"}
    </option>

    {shiftsQuery.data?.map((s: any) => (
      <option
        key={s.id}
        value={s.id}
        disabled={isFixedPlan && s.code !== "FULL_DAY"}
      >
        {s.name}
      </option>
    ))}
  </select>;

  /* =======================
     FIXED SEATS (via Seat Map)
  ======================= */

  const fixedSeatsQuery = useQuery<SeatMapLab[]>({
    queryKey: ["fixed-seats", today, fullTimeShift?.id],
    queryFn: () =>
      getSeatMap({
        date: today,
        shiftId: fullTimeShift!.id,
      }),
    enabled: loadFixedSeats && !!fullTimeShift?.id,
    staleTime: 5 * 60 * 1000,
  });

  /* Normalize seat-map response */
  const fixedSeats = useMemo(() => {
    if (!fixedSeatsQuery.data) return [];

    return fixedSeatsQuery.data
      .flatMap((lab) =>
        lab.rows.flatMap((row) =>
          row.seats.map((seat) => ({
            id: seat.seatId,
            seatNumber: seat.seatNumber,
            labName: lab.labName,
            status: seat.status,
          })),
        ),
      )
      .filter((seat) => seat.status === "FREE");
  }, [fixedSeatsQuery.data]);

  /* =======================
     PRICE PREVIEW
  ======================= */

  const pricePreviewQuery = useQuery({
    queryKey: ["price-preview", membershipPlanId, shiftId],
    queryFn: () =>
      previewPricing({
        planId: membershipPlanId,
        shiftId,
      }),
    enabled: !!membershipPlanId && !!shiftId,
  });

  /* =======================
     CREATE MEMBERSHIP
  ======================= */

  const createMutation = useMutation({
    mutationFn: createMembership,

    onSuccess: () => {
      // 1️⃣ Notify admin
      toast.success("Membership created successfully");

      // 2️⃣ Reset form (clean state)
      setStudentId("");
      setMembershipPlanId("");
      setShiftId("");
      setFixedSeatId("");
      setLoadFixedSeats(false);

      // 3️⃣ OPTIONAL: redirect
      // Uncomment ONE of the below depending on preference

      // navigate("/dashboard");
      // navigate("/seat-map");
    },

    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || "Failed to create membership",
      );
    },
  });

  const handleCreate = () => {
    if (!studentId || !membershipPlanId || !shiftId) return;

    createMutation.mutate({
      studentId,
      membershipPlanId,
      shiftId,
      startDate: new Date().toISOString(),
      ...(isFixedPlan && { fixedSeatId }),
    });
  };

  /* =======================
     RENDER
  ======================= */

  return (
    <div className="w-full px-6 py-6">
      {/* CENTER WRAPPER */}
      <div className="mx-auto max-w-lg">
        {/* MAIN CONTAINER — SAME AS PAYMENT */}
        <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h1 className="text-lg font-semibold text-stone-800">
            Create Membership
          </h1>

          {/* Student */}
          <select
            className="w-full h-9 rounded-md border border-stone-300 bg-white px-3"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select Student</option>
            {studentsQuery.data?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.mobile})
              </option>
            ))}
          </select>

          {/* Membership Plan */}
          <select
            className="w-full h-9 rounded-md border border-stone-300 bg-white px-3"
            value={membershipPlanId}
            onChange={(e) => {
              setMembershipPlanId(e.target.value);
              setFixedSeatId("");
            }}
          >
            <option value="">Select Membership Plan</option>
            {plansQuery.data?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Shift */}
          <select
            className="w-full h-9 rounded-md border border-stone-300 bg-white px-3 disabled:bg-stone-200"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            disabled={isFixedPlan}
          >
            <option value="">
              {isFixedPlan ? "FULL DAY (Fixed)" : "Select Shift"}
            </option>

            {shiftsQuery.data?.map((s: any) => (
              <option
                key={s.id}
                value={s.id}
                disabled={isFixedPlan && s.code !== "FULL_DAY"}
              >
                {s.name}
              </option>
            ))}
          </select>

          {/* Fixed Seat */}
          {isFixedPlan && (
            <select
              className="w-full h-9 rounded-md border border-stone-300 bg-white px-3"
              value={fixedSeatId}
              onChange={(e) => setFixedSeatId(e.target.value)}
              disabled={fixedSeatsQuery.isLoading}
            >
              <option value="">Select Fixed Seat</option>
              {fixedSeats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.labName} – Seat {seat.seatNumber}
                </option>
              ))}
            </select>
          )}

          {/* Price Preview */}
          {pricePreviewQuery.data && (
            <div className="bg-white border border-stone-200 rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-600">Monthly Fee</span>
                <span>₹ {pricePreviewQuery.data.monthlyFee}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-stone-600">Registration Fee</span>
                <span>₹ {pricePreviewQuery.data.registrationFee}</span>
              </div>

              <div className="flex justify-between pt-2 border-t font-semibold text-stone-800">
                <span>Total Payable</span>
                <span>
                  ₹{" "}
                  {pricePreviewQuery.data.monthlyFee +
                    pricePreviewQuery.data.registrationFee}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {createMutation.isError && (
            <p className="text-red-600 text-sm">
              {(createMutation.error as any)?.response?.data?.message ||
                "Failed to create membership"}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={
              createMutation.isPending ||
              !studentId ||
              !membershipPlanId ||
              !shiftId ||
              (isFixedPlan && !fixedSeatId)
            }
            className="h-9 w-full rounded-md bg-amber-700 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Membership"}
          </button>
        </div>
      </div>
    </div>
  );
  // (
  //   <div className="space-y-6 max-w-xl">
  //     <h1 className="text-2xl font-semibold">Create Membership</h1>

  //     {/* Student */}
  //     <select
  //       className="border p-2 rounded w-full"
  //       value={studentId}
  //       onChange={(e) => setStudentId(e.target.value)}
  //     >
  //       <option value="">Select Student</option>
  //       {studentsQuery.data?.map((s: any) => (
  //         <option key={s.id} value={s.id}>
  //           {s.name} ({s.mobile})
  //         </option>
  //       ))}
  //     </select>

  //     {/* Membership Plan */}
  //     <select
  //       className="border p-2 rounded w-full"
  //       value={membershipPlanId}
  //       onChange={(e) => {
  //         setMembershipPlanId(e.target.value);
  //         setFixedSeatId("");
  //       }}
  //     >
  //       <option value="">Select Membership Plan</option>
  //       {plansQuery.data?.map((p: any) => (
  //         <option key={p.id} value={p.id}>
  //           {p.name}
  //         </option>
  //       ))}
  //     </select>

  //     {/* Shift */}
  //     <select
  //       className="border p-2 rounded w-full bg-white disabled:bg-gray-100"
  //       value={shiftId}
  //       onChange={(e) => setShiftId(e.target.value)}
  //       disabled={isFixedPlan}
  //     >
  //       <option value="">
  //         {isFixedPlan ? "FULL DAY (Fixed)" : "Select Shift"}
  //       </option>

  //       {shiftsQuery.data?.map((s: any) => (
  //         <option
  //           key={s.id}
  //           value={s.id}
  //           disabled={isFixedPlan && s.code !== "FULL_DAY"}
  //         >
  //           {s.name}
  //         </option>
  //       ))}
  //     </select>

  //     {/* Fixed Seat */}
  //     {isFixedPlan && (
  //       <select
  //         className="border p-2 rounded w-full"
  //         value={fixedSeatId}
  //         onChange={(e) => setFixedSeatId(e.target.value)}
  //         disabled={fixedSeatsQuery.isLoading}
  //       >
  //         <option value="">Select Fixed Seat</option>
  //         {fixedSeats.map((seat) => (
  //           <option key={seat.id} value={seat.id}>
  //             {seat.labName} – Seat {seat.seatNumber}
  //           </option>
  //         ))}
  //       </select>
  //     )}

  //     {/* Price Preview */}
  //     {pricePreviewQuery.data && (
  //       <div className="bg-gray-50 border rounded p-4 space-y-1">
  //         <p>
  //           <strong>Monthly Fee:</strong> ₹ {pricePreviewQuery.data.monthlyFee}
  //         </p>
  //         <p>
  //           <strong>Registration Fee:</strong> ₹{" "}
  //           {pricePreviewQuery.data.registrationFee}
  //         </p>
  //         <p className="font-semibold">
  //           Total Payable: ₹{" "}
  //           {pricePreviewQuery.data.monthlyFee +
  //             pricePreviewQuery.data.registrationFee}
  //         </p>
  //       </div>
  //     )}

  //     {/* Error */}
  //     {createMutation.isError && (
  //       <p className="text-red-600 text-sm">
  //         {(createMutation.error as any)?.response?.data?.message ||
  //           "Failed to create membership"}
  //       </p>
  //     )}

  //     {/* Submit */}
  //     <button
  //       onClick={handleCreate}
  //       disabled={
  //         createMutation.isPending ||
  //         !studentId ||
  //         !membershipPlanId ||
  //         !shiftId ||
  //         (isFixedPlan && !fixedSeatId)
  //       }
  //       className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
  //     >
  //       {createMutation.isPending ? "Creating..." : "Create Membership"}
  //     </button>
  //   </div>
  // );
}
