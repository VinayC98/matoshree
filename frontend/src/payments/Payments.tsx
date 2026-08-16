import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CreditCard,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  createPayment,
  getMembershipAccount,
  type PaymentMode,
} from "../api/payment.api";
import { searchStudentOptions } from "../api/students.api";
import PaymentList from "./PaymentsList";

type StudentOption = {
  id: string;
  name: string;
  mobile: string;
  hasActiveMembership: boolean;
  activeMembership: {
    id: string;
    startDate: string;
    endDate: string;
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
  } | null;
};

type MembershipAccount = {
  account?: {
    status?: string | null;
    totalDue?: number | string | null;
    totalPaid?: number | string | null;
    outstanding?: number | string | null;
  };
  charges?: Array<{
    id: string;
    type?: string | null;
    status?: string | null;
    amountDue?: number | string | null;
    amountPaid?: number | string | null;
    outstanding?: number | string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
  }>;
};

type ApiError = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
  message?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const apiError = error as ApiError;

  const message = apiError.response?.data?.message ?? apiError.message;

  if (Array.isArray(message)) {
    return message.join(", ");
  }

  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

const MIN_SEARCH_LENGTH = 2;
const SEARCH_LIMIT = 10;

const paymentModes: Array<{
  value: PaymentMode;
  label: string;
  icon: typeof Banknote;
}> = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: WalletCards },
  { value: "CARD", label: "Card", icon: CreditCard },
];

const toAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const formatCurrency = (value: unknown) =>
  toAmount(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusLabel = (status?: string | null) => {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PARTIAL":
      return "Partial";
    case "PENDING":
      return "Yet to Pay";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status || "Unknown";
  }
};

const statusClass = (status?: string | null) => {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "PARTIAL":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "PENDING":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    case "CANCELLED":
      return "bg-stone-100 text-stone-500 ring-1 ring-stone-200";
    default:
      return "bg-stone-100 text-stone-600 ring-1 ring-stone-200";
  }
};

export default function Payments() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null,
  );
  const [amount, setAmount] = useState<number | "">("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [lastAddedPaymentId, setLastAddedPaymentId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const value = search.trim();

    const timer = window.setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!lastAddedPaymentId) return;

    const timer = window.setTimeout(() => {
      setLastAddedPaymentId(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [lastAddedPaymentId]);

  const studentsQuery = useQuery<StudentOption[]>({
    queryKey: ["student-options", debouncedSearch],
    queryFn: async () => {
      const result = await searchStudentOptions({
        search: debouncedSearch,
        limit: SEARCH_LIMIT,
      });

      return Array.isArray(result) ? (result as StudentOption[]) : [];
    },
    enabled: debouncedSearch.length >= MIN_SEARCH_LENGTH && !selectedStudent,
    staleTime: 30_000,
    retry: 2,
  });

  const studentOptions = useMemo(
    () => studentsQuery.data ?? [],
    [studentsQuery.data],
  );

  const membershipId = selectedStudent?.activeMembership?.id ?? "";

  const accountQuery = useQuery<MembershipAccount>({
    queryKey: ["membership-account", membershipId],
    queryFn: () => getMembershipAccount(membershipId),
    enabled: Boolean(membershipId),
    staleTime: 10_000,
    retry: 2,
  });

  const account = accountQuery.data;

  const outstandingCharges = useMemo(() => {
    if (!Array.isArray(account?.charges)) return [];

    return account.charges.filter(
      (charge) =>
        charge.status !== "PAID" &&
        charge.status !== "CANCELLED" &&
        toAmount(charge.outstanding) > 0,
    );
  }, [account]);

  const totalOutstanding = toAmount(account?.account?.outstanding);

  const mutation = useMutation({
    mutationFn: createPayment,

    onSuccess: (response) => {
      toast.success("Payment recorded successfully");

      setAmount("");

      const paymentId = response?.payment?.id ?? response?.id ?? null;
      setLastAddedPaymentId(paymentId);

      void queryClient.invalidateQueries({
        queryKey: ["payments"],
      });

      if (membershipId) {
        void queryClient.invalidateQueries({
          queryKey: ["membership-account", membershipId],
        });
      }

      // The highlight cleanup is handled by the effect below so its timer
      // is always cancelled if this component unmounts or the id changes.
    },

    onError: (error: unknown) => {
      const message = getErrorMessage(
        error,
        "Payment failed. No payment was recorded.",
      );

      toast.error(message);
    },
  });

  const selectStudent = (student: StudentOption) => {
    setSelectedStudent(student);
    setSearch(`${student.name} (${student.mobile})`);
    setDebouncedSearch("");
    setAmount("");
  };

  const clearStudent = () => {
    if (mutation.isPending) return;

    setSelectedStudent(null);
    setSearch("");
    setDebouncedSearch("");
    setAmount("");
  };

  const handleSubmit = () => {
    if (mutation.isPending) return;

    if (!selectedStudent) {
      toast.info("Select a student first.");
      return;
    }

    if (!selectedStudent.hasActiveMembership || !membershipId) {
      toast.error("This student does not have an active membership.");
      return;
    }

    if (accountQuery.isLoading) {
      toast.info("Please wait while the membership account loads.");
      return;
    }

    if (accountQuery.isError || !account) {
      toast.error("Membership account could not be loaded.");
      return;
    }

    const payableAmount = Number(amount);

    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    if (totalOutstanding <= 0) {
      toast.info("There is no outstanding amount to collect.");
      return;
    }

    if (payableAmount > totalOutstanding) {
      toast.error(
        `Maximum payable amount is ₹${formatCurrency(totalOutstanding)}.`,
      );
      return;
    }

    mutation.mutate({
      membershipId,
      amount: payableAmount,
      paymentMode,
      paymentType: "PARTIAL",
    });
  };

  const amountNumber = amount === "" ? 0 : Number(amount);

  const amountInvalid =
    amount !== "" &&
    (!Number.isFinite(amountNumber) ||
      amountNumber <= 0 ||
      amountNumber > totalOutstanding);

  const canSubmit =
    Boolean(selectedStudent?.hasActiveMembership) &&
    Boolean(membershipId) &&
    !accountQuery.isLoading &&
    !accountQuery.isError &&
    Boolean(account) &&
    totalOutstanding > 0 &&
    amount !== "" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber <= totalOutstanding &&
    !mutation.isPending;

  return (
    <div className="min-h-full bg-stone-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-5 sm:mb-6">
          <div className="flex items-start gap-3">
            <div className="hidden rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:block">
              <IndianRupee size={20} />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">
                Payments
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-stone-500">
                Record payments against outstanding membership charges.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {/* RECEIVE PAYMENT */}
          <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-stone-100 p-2 text-stone-600">
                <IndianRupee size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-800 sm:text-lg">
                  Receive Payment
                </h2>
                <p className="text-xs text-stone-500">
                  Select a student and collect the outstanding balance.
                </p>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              {/* STUDENT SEARCH */}
              {!selectedStudent ? (
                <div className="relative">
                  <label
                    htmlFor="payment-student-search"
                    className="mb-1.5 block text-xs font-medium text-stone-600"
                  >
                    Student
                  </label>

                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                    />

                    <input
                      id="payment-student-search"
                      autoComplete="off"
                      className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                      placeholder="Search name or mobile"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>

                  {search.trim().length > 0 &&
                    search.trim().length < MIN_SEARCH_LENGTH && (
                      <p className="mt-1.5 text-[11px] text-stone-400">
                        Enter at least {MIN_SEARCH_LENGTH} characters to search.
                      </p>
                    )}

                  {search.trim().length >= MIN_SEARCH_LENGTH && (
                    <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                      {studentsQuery.isLoading ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-sm text-stone-500">
                          <Loader2 size={15} className="animate-spin" />
                          Searching students...
                        </div>
                      ) : studentsQuery.isError ? (
                        <div className="flex items-start gap-2 px-3 py-4 text-sm text-red-700">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">Search failed.</p>
                            <button
                              type="button"
                              onClick={() => studentsQuery.refetch()}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline"
                            >
                              <RefreshCw size={12} />
                              Try again
                            </button>
                          </div>
                        </div>
                      ) : studentOptions.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-stone-500">
                          No students found.
                        </div>
                      ) : (
                        studentOptions.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectStudent(student)}
                            className="flex w-full items-center gap-3 border-b border-stone-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-amber-50/50"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                              <UserRound size={16} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-stone-800">
                                {student.name || "Unknown student"}
                              </div>

                              <div className="text-xs text-stone-500">
                                {student.mobile || "No mobile number"}
                              </div>

                              <div className="mt-1">
                                {student.hasActiveMembership ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                    <BadgeCheck size={12} />
                                    Active membership
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                                    <AlertCircle size={12} />
                                    No active membership
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* SELECTED STUDENT */
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <UserRound size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate font-medium text-stone-800">
                          {selectedStudent.name}
                        </div>
                        <div className="text-xs text-stone-500">
                          {selectedStudent.mobile}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearStudent}
                      disabled={mutation.isPending}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={13} />
                      Change
                    </button>
                  </div>

                  {selectedStudent.activeMembership && (
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-stone-200 pt-3 text-xs">
                      <InfoItem
                        label="Plan"
                        value={selectedStudent.activeMembership.plan.name}
                      />
                      <InfoItem
                        label="Shift"
                        value={selectedStudent.activeMembership.shift.name}
                      />
                      <InfoItem
                        label="Valid Till"
                        value={formatDate(
                          selectedStudent.activeMembership.endDate,
                        )}
                      />
                      <div>
                        <div className="mb-1 text-stone-400">Account</div>
                        {accountQuery.isLoading ? (
                          <div className="flex items-center gap-1 text-stone-500">
                            <Loader2 size={12} className="animate-spin" />
                            Loading
                          </div>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(
                              account?.account?.status,
                            )}`}
                          >
                            {statusLabel(account?.account?.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* NO MEMBERSHIP */}
              {selectedStudent && !selectedStudent.hasActiveMembership && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    This student does not have an active membership. A payment
                    cannot be recorded here.
                  </span>
                </div>
              )}

              {/* ACCOUNT */}
              {selectedStudent?.hasActiveMembership && (
                <>
                  {accountQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-6 text-sm text-stone-500">
                      <Loader2 size={16} className="animate-spin" />
                      Loading membership account...
                    </div>
                  ) : accountQuery.isError || !account ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle
                          size={16}
                          className="mt-0.5 shrink-0 text-red-600"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-red-800">
                            Failed to load membership account.
                          </p>
                          <button
                            type="button"
                            onClick={() => accountQuery.refetch()}
                            disabled={accountQuery.isFetching}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            <RefreshCw
                              size={12}
                              className={
                                accountQuery.isFetching ? "animate-spin" : ""
                              }
                            />
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ACCOUNT SUMMARY */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <SummaryItem
                          label="Total Due"
                          value={account.account?.totalDue}
                          tone="neutral"
                        />
                        <SummaryItem
                          label="Paid"
                          value={account.account?.totalPaid}
                          tone="success"
                        />
                        <SummaryItem
                          label="Outstanding"
                          value={account.account?.outstanding}
                          tone="warning"
                        />
                      </div>

                      {/* CHARGES */}
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="text-xs font-medium text-stone-600">
                            Outstanding Charges
                          </label>
                          <span className="text-xs text-stone-500">
                            {outstandingCharges.length} charge
                            {outstandingCharges.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                          {outstandingCharges.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                              <BadgeCheck size={16} />
                              All charges are fully paid.
                            </div>
                          ) : (
                            outstandingCharges.map((charge) => (
                              <div
                                key={charge.id}
                                className="rounded-xl border border-stone-200 bg-white p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium text-stone-800">
                                      {charge.type === "REGISTRATION"
                                        ? "Registration"
                                        : "Membership"}
                                    </div>

                                    {charge.periodStart && charge.periodEnd && (
                                      <div className="mt-1 text-xs text-stone-500">
                                        {formatDate(charge.periodStart)} →{" "}
                                        {formatDate(charge.periodEnd)}
                                      </div>
                                    )}
                                  </div>

                                  <span
                                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(
                                      charge.status,
                                    )}`}
                                  >
                                    {statusLabel(charge.status)}
                                  </span>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                  <ChargeAmount
                                    label="Due"
                                    value={charge.amountDue}
                                  />
                                  <ChargeAmount
                                    label="Paid"
                                    value={charge.amountPaid}
                                    valueClass="text-emerald-600"
                                  />
                                  <ChargeAmount
                                    label="Balance"
                                    value={charge.outstanding}
                                    valueClass="text-red-600"
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* PAYMENT AMOUNT */}
                      <div>
                        <label
                          htmlFor="payment-amount"
                          className="mb-1.5 block text-xs font-medium text-stone-600"
                        >
                          Payment Amount
                        </label>

                        <div className="relative">
                          <IndianRupee
                            size={17}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                          />

                          <input
                            id="payment-amount"
                            type="number"
                            min={0}
                            max={totalOutstanding}
                            step="0.01"
                            inputMode="decimal"
                            className={`h-11 w-full rounded-xl border bg-white pl-9 pr-4 text-lg font-medium text-stone-800 outline-none transition ${
                              amountInvalid
                                ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                : "border-stone-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                            }`}
                            placeholder="Enter amount"
                            value={amount}
                            onChange={(event) => {
                              const value = event.target.value;

                              if (value === "") {
                                setAmount("");
                                return;
                              }

                              const numeric = Number(value);

                              if (!Number.isFinite(numeric)) return;

                              setAmount(Math.max(0, numeric));
                            }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={
                              amountInvalid ? "text-red-600" : "text-stone-400"
                            }
                          >
                            {amountInvalid
                              ? `Enter an amount up to ₹${formatCurrency(
                                  totalOutstanding,
                                )}.`
                              : `Outstanding: ₹${formatCurrency(
                                  totalOutstanding,
                                )}`}
                          </span>

                          {totalOutstanding > 0 && (
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() =>
                                setAmount(Number(totalOutstanding.toFixed(2)))
                              }
                              className="font-medium text-amber-700 hover:underline disabled:opacity-50"
                            >
                              Pay full
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PAYMENT MODE */}
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-stone-600">
                          Payment Mode
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {paymentModes.map((mode) => {
                            const Icon = mode.icon;
                            const selected = paymentMode === mode.value;

                            return (
                              <button
                                key={mode.value}
                                type="button"
                                disabled={mutation.isPending}
                                onClick={() => setPaymentMode(mode.value)}
                                className={[
                                  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition",
                                  selected
                                    ? "border-amber-600 bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50",
                                  mutation.isPending
                                    ? "cursor-not-allowed opacity-60"
                                    : "",
                                ].join(" ")}
                              >
                                <Icon size={14} />
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* SUBMIT */}
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 font-medium text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {mutation.isPending ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Recording payment...
                          </>
                        ) : (
                          <>
                            <IndianRupee size={16} />
                            Receive ₹{formatCurrency(amountNumber)}
                          </>
                        )}
                      </button>

                      {mutation.isError && (
                        <p className="text-center text-xs text-red-600">
                          Payment could not be recorded. Please verify the
                          amount and try again.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </form>
          </section>

          {/* PAYMENT HISTORY */}
          <section className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-stone-200 bg-stone-100/80 p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 text-stone-600 shadow-sm">
                  <WalletCards size={18} />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-stone-800 sm:text-lg">
                    Recent Payments
                  </h2>
                  <p className="text-xs text-stone-500">
                    Review and export recorded payment activity.
                  </p>
                </div>
              </div>

              <PaymentList
                highlightPaymentId={lastAddedPaymentId}
                emptyFallback={
                  <div className="py-8 text-center text-sm italic text-stone-500">
                    No payments recorded yet.
                  </div>
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-stone-400">{label}</div>
      <div className="truncate font-medium text-stone-700">{value || "—"}</div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone: "neutral" | "success" | "warning";
}) {
  const toneClasses = {
    neutral: "border-stone-200 bg-stone-50 text-stone-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-xl border p-3 ${toneClasses[tone]}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-lg font-semibold">₹{formatCurrency(value)}</div>
    </div>
  );
}

function ChargeAmount({
  label,
  value,
  valueClass = "text-stone-700",
}: {
  label: string;
  value: unknown;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-stone-400">{label}</div>
      <div className={`mt-0.5 font-medium ${valueClass}`}>
        ₹{formatCurrency(value)}
      </div>
    </div>
  );
}
