import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  AlertCircle,
  BadgeCheck,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  getMembershipPlans,
  getShifts,
  getPricePreview,
  createMembership,
  renewMembership,
  changeMembership,
} from "../api/memberships.api";

import { searchStudentOptions, type StudentOption } from "../api/students.api";

import { getSeatMap } from "../api/seatMap.api";

/* =========================================================
   TYPES
========================================================= */

type MembershipMode = "NEW" | "RENEW" | "CHANGE";

type SeatMapSeat = {
  seatId: string;
  seatNumber: number;
  status: "FREE" | "OCCUPIED" | "FIXED";
  student: unknown | null;
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

type MembershipPlan = {
  id: string;
  name: string;
  code?: string;
  type?: string;
};

type Shift = {
  id: string;
  code: string;
  name: string;
};

type PaymentStatus = "YET_TO_PAY" | "PARTIAL" | "PAID";

type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function unwrapArray<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of keys) {
    const nested = value[key];

    if (Array.isArray(nested)) {
      return nested as T[];
    }
  }

  return [];
}

function toPaymentMode(value: string): PaymentMode {
  if (
    value === "CASH" ||
    value === "UPI" ||
    value === "CARD" ||
    value === "BANK_TRANSFER"
  ) {
    return value;
  }

  return "CASH";
}

function money(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "0";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!isRecord(error)) {
    return fallback;
  }

  const response = isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;

  const message = data?.message ?? error.message;

  if (Array.isArray(message)) {
    const messages = message.filter(
      (item): item is string => typeof item === "string",
    );

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  return typeof message === "string" && message.trim() ? message : fallback;
}

function normalizeAmount(value: string): number {
  if (!value.trim()) return 0;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : NaN;
}

function paymentStatusFor(paid: number, due: number): PaymentStatus {
  if (paid <= 0) return "YET_TO_PAY";
  if (paid >= due) return "PAID";
  return "PARTIAL";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Membership() {
  /* =======================================================
     MODE
  ======================================================= */

  const [mode, setMode] = useState<MembershipMode>("NEW");

  /* =======================================================
     COMMON STUDENT
  ======================================================= */

  const [studentId, setStudentId] = useState("");

  const [studentSearch, setStudentSearch] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null,
  );

  const [showStudentResults, setShowStudentResults] = useState(false);

  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState("");

  /* =======================================================
     NEW MEMBERSHIP
  ======================================================= */

  const [membershipPlanId, setMembershipPlanId] = useState("");

  const [shiftId, setShiftId] = useState("");

  const [fixedSeatId, setFixedSeatId] = useState("");

  const [newPaymentAmount, setNewPaymentAmount] = useState("");

  const [newPaymentMode, setNewPaymentMode] = useState<PaymentMode>("CASH");

  /* =======================================================
     RENEWAL
  ======================================================= */

  const [renewalPaymentAmount, setRenewalPaymentAmount] = useState("");

  const [renewalPaymentMode, setRenewalPaymentMode] =
    useState<PaymentMode>("CASH");
  /* =======================================================
     DATE
  ======================================================= */

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  /* =======================================================
     DEBOUNCE STUDENT SEARCH
  ======================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudentSearch(studentSearch.trim());
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [studentSearch]);

  /* =======================================================
     STUDENT SEARCH
  ======================================================= */

  const studentSearchQuery = useQuery({
    queryKey: ["student-options", debouncedStudentSearch, mode],

    queryFn: () =>
      searchStudentOptions({
        search: debouncedStudentSearch,
        limit: 10,

        /*
         * NEW:
         * Student should not have active membership.
         *
         * RENEW:
         * Student must have active membership.
         *
         * CHANGE:
         * Student must have active membership.
         */
        hasActiveMembership: mode === "NEW" ? false : true,
      }),

    enabled: debouncedStudentSearch.length >= 2,

    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const studentResults = useMemo(
    () =>
      unwrapArray<StudentOption>(studentSearchQuery.data, ["data", "students"]),
    [studentSearchQuery.data],
  );

  /* =======================================================
     MEMBERSHIP PLANS
  ======================================================= */

  const plansQuery = useQuery({
    queryKey: ["membership-plans"],

    queryFn: getMembershipPlans,

    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const membershipPlans = useMemo(
    () => unwrapArray<MembershipPlan>(plansQuery.data, ["data", "plans"]),
    [plansQuery.data],
  );

  /* =======================================================
     SELECTED PLAN
  ======================================================= */

  const selectedPlan = useMemo(() => {
    return membershipPlans.find((plan) => plan.id === membershipPlanId);
  }, [membershipPlans, membershipPlanId]);

  const isFixedPlan =
    selectedPlan?.code === "FIXED" || selectedPlan?.type === "FIXED";

  const isHalfPlan = selectedPlan?.code === "HALF";

  const isFullPlan = selectedPlan?.code === "FULL";

  /* =======================================================
     SHIFTS
  ======================================================= */

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],

    queryFn: getShifts,

    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const allShifts = useMemo(
    () => unwrapArray<Shift>(shiftsQuery.data, ["data", "shifts"]),
    [shiftsQuery.data],
  );

  /* =======================================================
     FILTER SHIFTS
  ======================================================= */

  const shifts = useMemo(() => {
    /*
     * HALF
     * Morning + Evening only.
     */
    if (isHalfPlan) {
      return allShifts.filter(
        (shift) => shift.code === "MORNING" || shift.code === "EVENING",
      );
    }

    /*
     * FULL
     * Full Day only.
     */
    if (isFullPlan) {
      return allShifts.filter((shift) => shift.code === "FULL_DAY");
    }

    /*
     * FIXED
     * Full Day only.
     */
    if (isFixedPlan) {
      return allShifts.filter((shift) => shift.code === "FULL_DAY");
    }

    return allShifts;
  }, [allShifts, isHalfPlan, isFullPlan, isFixedPlan]);

  /* =======================================================
     FULL DAY SHIFT
  ======================================================= */

  const fullDayShift = useMemo(() => {
    return allShifts.find((shift) => shift.code === "FULL_DAY");
  }, [allShifts]);

  /* =======================================================
     Change Membership
  ======================================================= */

  const [changePlanId, setChangePlanId] = useState("");

  const [changeShiftId, setChangeShiftId] = useState("");

  const [changeFixedSeatId, setChangeFixedSeatId] = useState("");

  const [changePaymentAmount, setChangePaymentAmount] = useState("");

  const [changePaymentMode, setChangePaymentMode] =
    useState<PaymentMode>("CASH");

  const selectedCurrentMembership = selectedStudent?.activeMembership ?? null;

  const changePlan = useMemo(() => {
    return membershipPlans.find((plan) => plan.id === changePlanId);
  }, [membershipPlans, changePlanId]);

  const changeIsHalf = changePlan?.code === "HALF";

  const changeIsFull = changePlan?.code === "FULL";

  const changeIsFixed = changePlan?.code === "FIXED";

  const effectiveChangeShiftId =
    changeIsFull || changeIsFixed ? (fullDayShift?.id ?? "") : changeShiftId;

  const changeShifts = useMemo(() => {
    if (changeIsHalf) {
      return allShifts.filter(
        (shift) => shift.code === "MORNING" || shift.code === "EVENING",
      );
    }

    if (changeIsFull || changeIsFixed) {
      return allShifts.filter((shift) => shift.code === "FULL_DAY");
    }

    return allShifts;
  }, [allShifts, changeIsHalf, changeIsFull, changeIsFixed]);

  /* =======================================================
     EFFECTIVE NEW MEMBERSHIP SHIFT
  ======================================================= */

  const effectiveShiftId =
    isFullPlan || isFixedPlan
      ? (fullDayShift?.id ?? "")
      : shifts.some((shift) => shift.id === shiftId)
        ? shiftId
        : "";

  /* =======================================================
     FIXED SEATS
  ======================================================= */

  const fixedSeatsQuery = useQuery<SeatMapLab[]>({
    queryKey: ["fixed-seats", today, fullDayShift?.id],

    queryFn: () =>
      getSeatMap({
        date: today,
        shiftId: fullDayShift!.id,
      }),

    enabled:
      mode === "NEW"
        ? isFixedPlan && !!fullDayShift?.id
        : mode === "CHANGE"
          ? changeIsFixed && !!fullDayShift?.id
          : false,

    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const fixedSeats = useMemo(() => {
    if (!fixedSeatsQuery.data) {
      return [];
    }

    if (!Array.isArray(fixedSeatsQuery.data)) return [];

    return fixedSeatsQuery.data
      .flatMap((lab) =>
        Array.isArray(lab?.rows)
          ? lab.rows.flatMap((row) =>
              Array.isArray(row?.seats)
                ? row.seats.map((seat) => ({
                    id: seat.seatId,
                    seatNumber: seat.seatNumber,
                    labName: lab.labName,
                    status: seat.status,
                  }))
                : [],
            )
          : [],
      )
      .filter((seat) => seat.status === "FREE" && !!seat.id);
  }, [fixedSeatsQuery.data]);

  /* =======================================================
     NEW PRICE PREVIEW
  ======================================================= */

  const pricePreviewQuery = useQuery({
    queryKey: ["price-preview", membershipPlanId, effectiveShiftId],

    queryFn: () =>
      getPricePreview({
        planId: membershipPlanId,
        shiftId: effectiveShiftId,
      }),

    enabled: mode === "NEW" && !!membershipPlanId && !!effectiveShiftId,

    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const changePriceQuery = useQuery({
    queryKey: ["change-price", changePlanId, effectiveChangeShiftId],

    queryFn: () =>
      getPricePreview({
        planId: changePlanId,
        shiftId: effectiveChangeShiftId,
      }),

    enabled: mode === "CHANGE" && !!changePlanId && !!effectiveChangeShiftId,

    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const changeMonthlyFee = changePriceQuery.data?.monthlyFee ?? 0;

  const changePaid = Number(changePaymentAmount) || 0;

  const changeOutstanding = Math.max(changeMonthlyFee - changePaid, 0);

  const monthlyFee = pricePreviewQuery.data?.monthlyFee ?? 0;

  const registrationFee = pricePreviewQuery.data?.registrationFee ?? 0;

  const newTotalDue = monthlyFee + registrationFee;

  const newPaidAmount = Number(newPaymentAmount) || 0;

  const newOutstanding = Math.max(newTotalDue - newPaidAmount, 0);

  const newPaymentStatus: PaymentStatus = paymentStatusFor(
    newPaidAmount,
    newTotalDue,
  );

  /* =======================================================
     CREATE MEMBERSHIP MUTATION
  ======================================================= */

  const createMutation = useMutation({
    mutationFn: createMembership,

    onSuccess: () => {
      toast.success("Membership created successfully");

      setStudentId("");
      setSelectedStudent(null);

      setStudentSearch("");
      setDebouncedStudentSearch("");

      setMembershipPlanId("");
      setShiftId("");
      setFixedSeatId("");

      setNewPaymentAmount("");
      setNewPaymentMode("CASH");
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create membership."));
    },
  });

  /* =======================================================
     RENEW MUTATION
  ======================================================= */

  const renewMutation = useMutation({
    mutationFn: renewMembership,

    onSuccess: (response: unknown) => {
      const responseRecord = isRecord(response) ? response : {};
      const summary = responseRecord.paymentSummary;
      const membership = isRecord(responseRecord.membership)
        ? responseRecord.membership
        : undefined;
      const responseEndDate = getString(membership?.endDate);

      toast.success("Membership renewed successfully");

      /*
       * Update selected student
       * locally so the UI immediately
       * reflects the new end date.
       */
      if (selectedStudent && summary) {
        setSelectedStudent({
          ...selectedStudent,

          activeMembership: selectedStudent.activeMembership
            ? {
                ...selectedStudent.activeMembership,

                endDate:
                  responseEndDate ?? selectedStudent.activeMembership.endDate,
              }
            : selectedStudent.activeMembership,

          hasActiveMembership: true,
        });
      }

      setRenewalPaymentAmount("");
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to renew membership."));
    },
  });

  /* =======================================================
     RENEWAL DISPLAY VALUES
  ======================================================= */

  const currentMembership = selectedStudent?.activeMembership;

  /* =======================================================
      CHANGE MEMBERSHIP MUTATION
  ======================================================= */
  const changeMutation = useMutation({
    mutationFn: changeMembership,

    onSuccess: () => {
      toast.success("Membership changed successfully");

      /*
       * Reset change form.
       */
      setChangePlanId("");
      setChangeShiftId("");
      setChangeFixedSeatId("");
      setChangePaymentAmount("");
      setChangePaymentMode("CASH");

      /*
       * Clear selected student so the
       * operator searches again and gets
       * fresh membership data.
       */
      setSelectedStudent(null);
      setStudentId("");
      setStudentSearch("");
      setDebouncedStudentSearch("");
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to change membership."));
    },
  });

  const handleChangeMembership = () => {
    if (!studentId) {
      toast.error("Please select a student");
      return;
    }

    if (!selectedCurrentMembership) {
      toast.error("Student does not have an active membership");
      return;
    }

    if (!changePlanId) {
      toast.error("Please select a membership plan");
      return;
    }

    const currentPlanId =
      selectedCurrentMembership.plan?.id ?? selectedCurrentMembership.planId;

    if (currentPlanId && currentPlanId === changePlanId) {
      toast.error("The selected plan is already active.");
      return;
    }

    if (!effectiveChangeShiftId) {
      toast.error("Please select a shift");
      return;
    }

    if (changeIsFixed && !changeFixedSeatId) {
      toast.error("Please select a fixed seat");
      return;
    }

    const selectedShift = allShifts.find(
      (shift) => shift.id === effectiveChangeShiftId,
    );

    if (
      changeIsHalf &&
      (!selectedShift?.code ||
        !["MORNING", "EVENING"].includes(selectedShift.code))
    ) {
      toast.error("Half Time only supports Morning or Evening");
      return;
    }

    if ((changeIsFull || changeIsFixed) && selectedShift?.code !== "FULL_DAY") {
      toast.error("This membership requires Full Day shift");
      return;
    }

    if (changePriceQuery.isFetching || !changePriceQuery.data) {
      toast.info("Please wait for change pricing.");
      return;
    }

    const amount = normalizeAmount(changePaymentAmount);

    if (!Number.isFinite(amount) || amount < 0 || amount > changeMonthlyFee) {
      toast.error(
        `Payment must be between ₹0 and ₹${money(changeMonthlyFee)}.`,
      );
      return;
    }

    if (
      changeIsFixed &&
      !fixedSeats.some((seat) => seat.id === changeFixedSeatId)
    ) {
      toast.error("The selected fixed seat is no longer available.");
      return;
    }

    changeMutation.mutate({
      studentId,

      membershipPlanId: changePlanId,

      shiftId: effectiveChangeShiftId,

      startDate: new Date().toISOString(),

      ...(changeIsFixed && {
        fixedSeatId: changeFixedSeatId,
      }),

      initialPaymentAmount: amount,

      paymentMode: changePaymentMode,
    });
  };

  /*
   * The student search API should return
   * activeMembership.plan / shift / endDate.
   *
   * Renewal price is fetched from the
   * current plan + shift.
   */

  const renewalPlanId =
    currentMembership?.plan?.id ?? currentMembership?.planId ?? "";

  const renewalShiftId =
    currentMembership?.shift?.id ?? currentMembership?.shiftId ?? "";

  const renewalPriceQuery = useQuery({
    queryKey: ["renewal-price", renewalPlanId, renewalShiftId],

    queryFn: () =>
      getPricePreview({
        planId: renewalPlanId,
        shiftId: renewalShiftId,
      }),

    enabled: mode === "RENEW" && !!renewalPlanId && !!renewalShiftId,

    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const renewalAmount = renewalPriceQuery.data?.monthlyFee ?? 0;

  /*
   * For the current phase the UI doesn't
   * accept advance payment.
   */
  const renewalPaidInput = Number(renewalPaymentAmount) || 0;

  const renewalInputValid =
    renewalPaidInput >= 0 && renewalPaidInput <= renewalAmount;

  const renewalRemaining = Math.max(renewalAmount - renewalPaidInput, 0);

  const renewalInputStatus: PaymentStatus = paymentStatusFor(
    renewalPaidInput,
    renewalAmount,
  );

  /* =======================================================
     STUDENT SELECTION
  ======================================================= */

  const handleStudentSelect = (student: StudentOption) => {
    setSelectedStudent(student);

    setStudentId(student.id);

    setStudentSearch(student.name);

    setDebouncedStudentSearch("");

    setShowStudentResults(false);

    /*
     * Reset payment when selecting
     * another student.
     */
    setRenewalPaymentAmount("");
    setChangePlanId("");
    setChangeShiftId("");
    setChangeFixedSeatId("");
    setChangePaymentAmount("");
  };

  /* =======================================================
     MODE CHANGE
  ======================================================= */

  const handleModeChange = (nextMode: MembershipMode) => {
    if (
      createMutation.isPending ||
      renewMutation.isPending ||
      changeMutation.isPending
    )
      return;

    setMode(nextMode);

    setStudentId("");

    setStudentSearch("");

    setSelectedStudent(null);

    setDebouncedStudentSearch("");

    setShowStudentResults(false);

    setMembershipPlanId("");

    setShiftId("");

    setFixedSeatId("");

    setNewPaymentAmount("");

    setRenewalPaymentAmount("");

    setChangePlanId("");
    setChangeShiftId("");
    setChangeFixedSeatId("");
    setChangePaymentAmount("");

    setNewPaymentMode("CASH");

    setRenewalPaymentMode("CASH");

    setChangePaymentMode("CASH");
  };

  /* =======================================================
     CREATE HANDLER
  ======================================================= */

  const handleCreate = () => {
    if (!studentId) {
      toast.error("Please select a student");
      return;
    }

    if (!membershipPlanId) {
      toast.error("Please select a membership plan");
      return;
    }

    if (!effectiveShiftId) {
      toast.error("Unable to determine the required shift.");
      return;
    }

    if (isFixedPlan && !fixedSeatId) {
      toast.error("Please select a fixed seat");
      return;
    }

    /*
     * Frontend safety rules.
     */
    const selectedShift = allShifts.find(
      (shift) => shift.id === effectiveShiftId,
    );

    if (
      isHalfPlan &&
      (!selectedShift?.code ||
        !["MORNING", "EVENING"].includes(selectedShift.code))
    ) {
      toast.error("Half Time only supports Morning or Evening");
      return;
    }

    if ((isFullPlan || isFixedPlan) && selectedShift?.code !== "FULL_DAY") {
      toast.error("This membership requires Full Day shift");
      return;
    }

    if (!selectedStudent) {
      toast.error("Please select a valid student from the results.");
      return;
    }

    if (selectedStudent.hasActiveMembership) {
      toast.error("This student already has an active membership.");
      return;
    }

    if (pricePreviewQuery.isFetching || !pricePreviewQuery.data) {
      toast.info("Please wait for pricing to finish loading.");
      return;
    }

    if (pricePreviewQuery.isError) {
      toast.error("Unable to load pricing. Please try again.");
      return;
    }

    const amount = normalizeAmount(newPaymentAmount);

    if (!Number.isFinite(amount) || amount < 0 || amount > newTotalDue) {
      toast.error(`Payment must be between ₹0 and ₹${money(newTotalDue)}.`);
      return;
    }

    if (isFixedPlan && !fixedSeats.some((seat) => seat.id === fixedSeatId)) {
      toast.error("The selected fixed seat is no longer available.");
      return;
    }

    createMutation.mutate({
      studentId,

      membershipPlanId,

      shiftId: effectiveShiftId,

      startDate: new Date().toISOString(),

      ...(isFixedPlan && {
        fixedSeatId,
      }),

      initialPaymentAmount: amount,

      paymentMode: newPaymentMode,
    });
  };

  /* =======================================================
     RENEW HANDLER
  ======================================================= */

  const handleRenew = () => {
    if (!studentId) {
      toast.error("Please select a student");
      return;
    }

    if (!currentMembership) {
      toast.error("Selected student does not have an active membership");
      return;
    }

    if (!renewalPlanId || !renewalShiftId) {
      toast.error("Unable to determine current membership pricing");
      return;
    }

    if (renewalPriceQuery.isLoading) {
      toast.error("Please wait for renewal pricing");
      return;
    }

    if (!renewalPriceQuery.data) {
      toast.error("Renewal pricing is not configured");
      return;
    }

    if (renewalPriceQuery.isFetching || !renewalPriceQuery.data) {
      toast.info("Please wait for renewal pricing.");
      return;
    }

    const amount = normalizeAmount(renewalPaymentAmount);

    if (!Number.isFinite(amount) || amount < 0 || amount > renewalAmount) {
      toast.error(`Payment must be between ₹0 and ₹${money(renewalAmount)}.`);
      return;
    }

    renewMutation.mutate({
      studentId,

      paymentAmount: amount,

      paymentMode: renewalPaymentMode,
    });
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full w-full bg-stone-50 px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="space-y-4 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100/80 p-3 shadow-sm sm:space-y-5 sm:p-5">
          {/* =================================================
              HEADER
          ================================================= */}

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <BadgeCheck size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-stone-800 sm:text-xl">
                Membership
              </h1>
              <p className="mt-1 text-xs text-stone-500 sm:text-sm">
                Manage student memberships safely and smoothly.
              </p>
            </div>
          </div>

          {/* =================================================
              MODE
          ================================================= */}

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1 sm:gap-2">
            {(
              [
                ["NEW", "New"],
                ["RENEW", "Renew"],
                ["CHANGE", "Change"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                disabled={
                  createMutation.isPending ||
                  renewMutation.isPending ||
                  changeMutation.isPending
                }
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                  mode === value
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {value === "NEW" && <Sparkles size={14} />}
                {value === "RENEW" && <RefreshCw size={14} />}
                {value === "CHANGE" && <Zap size={14} />}
                {label}
              </button>
            ))}
          </div>

          {/* =================================================
              STUDENT SEARCH
          ================================================= */}

          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-stone-600">
              Student
            </label>

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  const value = e.target.value;

                  setStudentSearch(value);

                  setSelectedStudent(null);

                  setStudentId("");

                  setShowStudentResults(true);
                }}
                onFocus={() => {
                  if (studentSearch.trim().length >= 2) {
                    setShowStudentResults(true);
                  }
                }}
                placeholder={
                  mode === "NEW"
                    ? "Search student name or mobile"
                    : "Search active student"
                }
                disabled={
                  createMutation.isPending ||
                  renewMutation.isPending ||
                  changeMutation.isPending
                }
                className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100"
              />
            </div>

            {/* =================================================
                SEARCH RESULTS
            ================================================= */}

            {showStudentResults && debouncedStudentSearch.length >= 2 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-stone-200 bg-white shadow-lg overflow-hidden">
                {studentSearchQuery.isLoading && (
                  <div className="flex items-center gap-2 p-3 text-xs text-stone-500">
                    <Loader2
                      size={14}
                      className="animate-spin text-amber-600"
                    />
                    Searching students...
                  </div>
                )}

                {studentSearchQuery.isError && (
                  <div className="flex items-start gap-2 p-3 text-xs text-red-700">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Failed to search students. Please refine the search or try
                      again.
                    </span>
                  </div>
                )}

                {!studentSearchQuery.isLoading &&
                  !studentSearchQuery.isError &&
                  studentResults.length === 0 && (
                    <div className="p-3 text-sm text-stone-500">
                      No eligible students found.
                    </div>
                  )}

                {studentResults.map((student) => (
                  <button
                    type="button"
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className="w-full text-left px-3 py-3 hover:bg-stone-50 border-b border-stone-100 last:border-b-0"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm text-stone-800">
                          {student.name}
                        </div>

                        <div className="text-xs text-stone-500 mt-0.5">
                          {student.mobile}
                        </div>
                      </div>

                      {student.hasActiveMembership && (
                        <span className="text-[11px] bg-green-50 text-green-700 px-2 py-1 rounded h-fit">
                          Active
                        </span>
                      )}
                    </div>

                    {student.activeMembership && (
                      <div className="text-xs text-stone-500 mt-2">
                        {student.activeMembership.plan?.name}

                        {" · "}

                        {student.activeMembership.shift?.name}

                        {" · Till "}

                        {new Date(
                          student.activeMembership.endDate,
                        ).toLocaleDateString("en-IN")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* =================================================
                SELECTED STUDENT
            ================================================= */}

            {selectedStudent && (
              <div className="mt-2 overflow-hidden rounded-xl border border-amber-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-stone-800">
                      {selectedStudent.name}
                    </div>

                    <div className="text-xs text-stone-500">
                      {selectedStudent.mobile}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setStudentId("");
                      setStudentSearch("");
                      setDebouncedStudentSearch("");
                    }}
                    className="text-xs text-stone-500 hover:text-red-600"
                  >
                    Change
                  </button>
                </div>

                {selectedStudent.activeMembership && (
                  <>
                    {/* Current membership */}

                    <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-stone-400">Plan</div>

                        <div className="font-medium text-stone-700">
                          {selectedStudent.activeMembership.plan?.name}
                        </div>
                      </div>

                      <div>
                        <div className="text-stone-400">Shift</div>

                        <div className="font-medium text-stone-700">
                          {selectedStudent.activeMembership.shift?.name}
                        </div>
                      </div>

                      <div>
                        <div className="text-stone-400">Valid Till</div>

                        <div className="font-medium text-stone-700">
                          {new Date(
                            selectedStudent.activeMembership.endDate,
                          ).toLocaleDateString("en-IN")}
                        </div>
                      </div>

                      <div>
                        <div className="text-stone-400">Payment Status</div>

                        <div
                          className={`font-medium ${
                            selectedStudent.paymentStatus === "PAID"
                              ? "text-green-600"
                              : selectedStudent.paymentStatus === "PARTIAL"
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {selectedStudent.paymentStatus === "PAID"
                            ? "Paid"
                            : selectedStudent.paymentStatus === "PARTIAL"
                              ? "Partial Paid"
                              : "Yet to Pay"}
                        </div>
                      </div>
                    </div>

                    {/* Account summary */}

                    <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-stone-400">Total Due</div>

                        <div className="font-medium text-stone-700">
                          ₹{selectedStudent.account?.totalDue ?? 0}
                        </div>
                      </div>

                      <div>
                        <div className="text-stone-400">Paid</div>

                        <div className="font-medium text-green-600">
                          ₹{selectedStudent.account?.totalPaid ?? 0}
                        </div>
                      </div>

                      <div>
                        <div className="text-stone-400">Outstanding</div>

                        <div
                          className={`font-medium ${
                            Number(selectedStudent.account?.outstanding ?? 0) >
                            0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          ₹{selectedStudent.account?.outstanding ?? 0}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* =================================================
              NEW MEMBERSHIP
          ================================================= */}

          {mode === "NEW" && (
            <>
              {/* PLAN */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-600">
                  Membership Plan
                </label>

                <select
                  disabled={createMutation.isPending}
                  value={membershipPlanId}
                  onChange={(e) => {
                    setMembershipPlanId(e.target.value);

                    /*
                     * Clear old shift.
                     */
                    setShiftId("");

                    setFixedSeatId("");

                    setNewPaymentAmount("");
                  }}
                  className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                >
                  <option value="">Select Membership Plan</option>

                  {membershipPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              {plansQuery.isError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle size={13} /> Unable to load membership plans.
                </p>
              )}

              {/* SHIFT */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-600">
                  Shift
                </label>

                {isFullPlan || isFixedPlan ? (
                  <div className="w-full h-9 rounded-md border border-stone-300 bg-stone-100 px-3 flex items-center text-sm text-stone-700">
                    Full Day
                  </div>
                ) : (
                  <select
                    disabled={
                      createMutation.isPending ||
                      !membershipPlanId ||
                      shiftsQuery.isLoading
                    }
                    value={shiftId}
                    onChange={(e) => {
                      setShiftId(e.target.value);

                      setNewPaymentAmount("");
                    }}
                    className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                  >
                    <option value="">Select Shift</option>

                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name}
                      </option>
                    ))}
                  </select>
                )}

                {shiftsQuery.isError && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle size={13} />
                    Unable to load shifts.
                  </p>
                )}

                {isHalfPlan && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-stone-500">
                    Half Time is available only for Morning and Evening.
                  </p>
                )}
              </div>

              {/* FIXED SEAT */}

              {isFixedPlan && (
                <div>
                  <label className="block text-sm text-stone-600 mb-1">
                    Fixed Seat
                  </label>

                  <select
                    value={fixedSeatId}
                    onChange={(e) => setFixedSeatId(e.target.value)}
                    disabled={fixedSeatsQuery.isLoading}
                    className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                  >
                    <option value="">Select Fixed Seat</option>

                    {fixedSeats.map((seat) => (
                      <option key={seat.id} value={seat.id}>
                        {seat.labName} - Seat {seat.seatNumber}
                      </option>
                    ))}
                  </select>

                  {fixedSeatsQuery.isLoading && (
                    <p className="text-xs text-stone-500 mt-1">
                      Loading available seats...
                    </p>
                  )}

                  {fixedSeatsQuery.isError && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle size={13} />
                      Unable to load available seats.
                    </p>
                  )}

                  {!fixedSeatsQuery.isLoading &&
                    !fixedSeatsQuery.isError &&
                    fixedSeats.length === 0 && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
                        <AlertCircle size={13} />
                        No fixed seats available.
                      </p>
                    )}
                </div>
              )}

              {/* PRICE */}

              {pricePreviewQuery.data && (
                <div className="bg-white border border-stone-200 rounded-md p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Membership Fee</span>

                      <span>₹{monthlyFee}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-stone-500">Registration Fee</span>

                      <span>₹{registrationFee}</span>
                    </div>

                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total</span>

                      <span>₹{newTotalDue}</span>
                    </div>
                  </div>

                  {/* PAYMENT */}

                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-stone-600">
                        Amount Paid
                      </label>

                      <input
                        type="number"
                        min={0}
                        max={newTotalDue}
                        value={newPaymentAmount}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (value === "") {
                            setNewPaymentAmount("");
                            return;
                          }

                          const amount = Number(value);

                          if (amount < 0) {
                            return;
                          }

                          setNewPaymentAmount(
                            String(Math.min(amount, newTotalDue)),
                          );
                        }}
                        className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-stone-600">
                        Payment Mode
                      </label>

                      <select
                        value={newPaymentMode}
                        onChange={(e) =>
                          setNewPaymentMode(toPaymentMode(e.target.value))
                        }
                        className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                      >
                        <option value="CASH">Cash</option>

                        <option value="UPI">UPI</option>

                        <option value="CARD">Card</option>

                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  {/* SUMMARY */}

                  <div className="mt-4 pt-3 border-t space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Paid</span>

                      <span>₹{newPaidAmount}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-stone-500">Outstanding</span>

                      <span className="font-medium text-red-600">
                        ₹{newOutstanding}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-stone-500">Status</span>

                      <span
                        className={
                          newPaymentStatus === "PAID"
                            ? "text-green-600 font-medium"
                            : newPaymentStatus === "PARTIAL"
                              ? "text-amber-600 font-medium"
                              : "text-red-600 font-medium"
                        }
                      >
                        {newPaymentStatus === "YET_TO_PAY"
                          ? "Yet to Pay"
                          : newPaymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {membershipPlanId &&
                effectiveShiftId &&
                pricePreviewQuery.isLoading && (
                  <p className="flex items-center gap-2 text-xs text-stone-500">
                    <Loader2
                      size={14}
                      className="animate-spin text-amber-600"
                    />
                    Loading pricing...
                  </p>
                )}

              {pricePreviewQuery.isError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle size={13} />
                  Failed to load pricing. Please reselect the plan or shift.
                </p>
              )}

              {/* CREATE */}

              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  createMutation.isPending ||
                  !studentId ||
                  !membershipPlanId ||
                  !effectiveShiftId ||
                  (isFixedPlan && !fixedSeatId)
                }
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <BadgeCheck size={15} />
                    Create Membership
                  </>
                )}
              </button>
            </>
          )}

          {/* =================================================
              RENEW
          ================================================= */}

          {mode === "RENEW" && (
            <>
              {!selectedStudent ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center">
                  <div className="text-sm font-medium text-stone-800">
                    Renew Membership
                  </div>

                  <p className="text-sm text-stone-500 mt-2">
                    Search and select an active student above.
                  </p>
                </div>
              ) : !currentMembership ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-4 text-red-700">
                  This student does not have an active membership available for
                  renewal.
                </div>
              ) : (
                <>
                  {/* CURRENT MEMBERSHIP */}

                  <div className="bg-white border border-stone-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs text-stone-400">
                          CURRENT MEMBERSHIP
                        </div>

                        <div className="font-semibold text-stone-800 mt-1">
                          {currentMembership.plan?.name}
                        </div>

                        <div className="text-sm text-stone-500 mt-1">
                          {currentMembership.shift?.name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-stone-400">VALID TILL</div>

                        <div className="font-medium text-stone-800 mt-1">
                          {new Date(
                            currentMembership.endDate,
                          ).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RENEWAL PRICE */}

                  {renewalPriceQuery.isLoading && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4 text-sm text-stone-500">
                      Loading renewal pricing...
                    </div>
                  )}

                  {renewalPriceQuery.isError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-4 text-red-700">
                      Renewal pricing is not configured for this membership.
                    </div>
                  )}

                  {renewalPriceQuery.data && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                      <div className="text-xs text-stone-400 mb-3">RENEWAL</div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-600">
                          Renewal Fee
                        </span>

                        <span className="text-lg font-semibold text-stone-800">
                          ₹{renewalAmount}
                        </span>
                      </div>

                      <p className="text-xs text-stone-500 mt-2">
                        No registration fee is charged on renewal.
                      </p>
                    </div>
                  )}

                  {/* PAYMENT */}

                  {renewalPriceQuery.data && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-stone-800 mb-3">
                        Payment
                      </div>

                      <div>
                        <label className="block text-sm text-stone-600 mb-1">
                          Amount Paid
                        </label>

                        <input
                          type="number"
                          min={0}
                          max={renewalAmount}
                          value={renewalPaymentAmount}
                          onChange={(e) => {
                            const value = e.target.value;

                            if (value === "") {
                              setRenewalPaymentAmount("");
                              return;
                            }

                            const amount = Number(value);

                            if (amount < 0) {
                              return;
                            }

                            setRenewalPaymentAmount(
                              String(Math.min(amount, renewalAmount)),
                            );
                          }}
                          className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          placeholder={`Up to ₹${renewalAmount}`}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm text-stone-600 mb-1">
                          Payment Mode
                        </label>

                        <select
                          value={renewalPaymentMode}
                          onChange={(e) =>
                            setRenewalPaymentMode(toPaymentMode(e.target.value))
                          }
                          className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                        >
                          <option value="CASH">Cash</option>

                          <option value="UPI">UPI</option>

                          <option value="CARD">Card</option>

                          <option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                      </div>

                      <div className="mt-4 pt-3 border-t space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Renewal Fee</span>

                          <span>₹{renewalAmount}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-stone-500">This Payment</span>

                          <span>₹{renewalPaidInput}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-stone-500">
                            Renewal Balance
                          </span>

                          <span className="font-medium">
                            ₹{renewalRemaining}
                          </span>
                        </div>

                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-stone-500">Status</span>

                          <span
                            className={
                              renewalInputStatus === "PAID"
                                ? "text-green-600 font-medium"
                                : renewalInputStatus === "PARTIAL"
                                  ? "text-amber-600 font-medium"
                                  : "text-red-600 font-medium"
                            }
                          >
                            {renewalInputStatus === "YET_TO_PAY"
                              ? "Yet to Pay"
                              : renewalInputStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* IMPORTANT ACCOUNTING NOTE */}

                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    If this student has an older unpaid balance, the payment
                    will automatically be applied to the oldest outstanding
                    charge first.
                  </div>

                  {/* RENEW BUTTON */}

                  <button
                    type="button"
                    onClick={handleRenew}
                    disabled={
                      renewMutation.isPending ||
                      !studentId ||
                      !currentMembership ||
                      !renewalPriceQuery.data ||
                      !renewalInputValid
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {renewMutation.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Renewing...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={15} />
                        Renew Membership
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}

          {/* =================================================
              CHANGE
          ================================================= */}

          {mode === "CHANGE" && (
            <>
              {!selectedStudent ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center">
                  <div className="text-sm font-medium text-stone-800">
                    Change Membership
                  </div>

                  <p className="text-sm text-stone-500 mt-2">
                    Search and select an active student above.
                  </p>
                </div>
              ) : !selectedCurrentMembership ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-4 text-red-700">
                  This student does not have an active membership that can be
                  changed.
                </div>
              ) : (
                <>
                  {/* CURRENT MEMBERSHIP */}

                  <div className="bg-white border border-stone-200 rounded-lg p-4">
                    <div className="text-xs text-stone-400 mb-3">
                      CURRENT MEMBERSHIP
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-stone-400">Plan</div>

                        <div className="font-medium text-stone-800 mt-1">
                          {selectedCurrentMembership.plan?.name}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-stone-400">Shift</div>

                        <div className="font-medium text-stone-800 mt-1">
                          {selectedCurrentMembership.shift?.name}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-stone-400">Valid Till</div>

                        <div className="font-medium text-stone-800 mt-1">
                          {new Date(
                            selectedCurrentMembership.endDate,
                          ).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WARNING */}

                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-4 text-amber-800">
                    The change takes effect immediately. The current membership
                    will be closed and a new membership will start today.
                  </div>

                  {/* NEW PLAN */}

                  <div>
                    <label className="block text-sm text-stone-600 mb-1">
                      New Membership Plan
                    </label>

                    <select
                      value={changePlanId}
                      onChange={(e) => {
                        setChangePlanId(e.target.value);

                        setChangeShiftId("");

                        setChangeFixedSeatId("");

                        setChangePaymentAmount("");
                      }}
                      className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                    >
                      <option value="">Select Membership Plan</option>

                      {membershipPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* NEW SHIFT */}

                  <div>
                    <label className="block text-sm text-stone-600 mb-1">
                      New Shift
                    </label>

                    {changeIsFull || changeIsFixed ? (
                      <div className="w-full h-9 rounded-md border border-stone-300 bg-stone-100 px-3 flex items-center text-sm text-stone-700">
                        Full Day
                      </div>
                    ) : (
                      <select
                        value={changeShiftId}
                        onChange={(e) => {
                          setChangeShiftId(e.target.value);

                          setChangePaymentAmount("");
                        }}
                        className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                      >
                        <option value="">Select Shift</option>

                        {changeShifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* FIXED SEAT */}

                  {changeIsFixed && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-stone-600">
                        New Fixed Seat
                      </label>

                      <select
                        value={changeFixedSeatId}
                        onChange={(e) => setChangeFixedSeatId(e.target.value)}
                        className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                      >
                        <option value="">Select Fixed Seat</option>

                        {fixedSeats.map((seat) => (
                          <option key={seat.id} value={seat.id}>
                            {seat.labName} - Seat {seat.seatNumber}
                          </option>
                        ))}
                      </select>

                      {fixedSeats.length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          No fixed seats available.
                        </p>
                      )}
                    </div>
                  )}

                  {/* PRICE */}

                  {changePriceQuery.data && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                      <div className="text-xs text-stone-400 mb-3">
                        NEW MEMBERSHIP
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-stone-500">
                          Membership Fee
                        </span>

                        <span className="font-semibold">
                          ₹{changeMonthlyFee}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-stone-500">
                        Registration fee is not charged for membership changes.
                      </div>
                    </div>
                  )}

                  {/* PAYMENT */}

                  {changePriceQuery.data && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-stone-800 mb-3">
                        Initial Payment
                      </div>

                      <input
                        type="number"
                        min={0}
                        max={changeMonthlyFee}
                        value={changePaymentAmount}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (value === "") {
                            setChangePaymentAmount("");
                            return;
                          }

                          const amount = Number(value);

                          if (amount < 0) {
                            return;
                          }

                          setChangePaymentAmount(
                            String(Math.min(amount, changeMonthlyFee)),
                          );
                        }}
                        className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        placeholder={`Up to ₹${changeMonthlyFee}`}
                      />

                      <select
                        value={changePaymentMode}
                        onChange={(e) =>
                          setChangePaymentMode(toPaymentMode(e.target.value))
                        }
                        className="w-full h-9 mt-3 rounded-md border border-stone-300 bg-white px-3"
                      >
                        <option value="CASH">Cash</option>

                        <option value="UPI">UPI</option>

                        <option value="CARD">Card</option>

                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>

                      <div className="mt-4 pt-3 border-t space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Amount Due</span>

                          <span>₹{changeMonthlyFee}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-stone-500">Paid</span>

                          <span>₹{changePaid}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-stone-500">Outstanding</span>

                          <span className="text-red-600 font-medium">
                            ₹{changeOutstanding}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CHANGE */}

                  <button
                    type="button"
                    onClick={handleChangeMembership}
                    disabled={
                      changeMutation.isPending ||
                      !studentId ||
                      !changePlanId ||
                      !changeShiftId ||
                      (changeIsFixed && !changeFixedSeatId) ||
                      !changePriceQuery.data
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {changeMutation.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Zap size={15} />
                        Change Membership
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}

          <div className="flex items-start gap-2 pt-1 text-[10px] leading-4 text-stone-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            <span>
              Pricing, eligibility and fixed-seat availability are checked again
              before submission.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
