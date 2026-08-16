import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getStudentDetails } from "../api/students.api";
import {
  getMembershipPlans,
  getShifts,
  renewMembership,
  changeMembership,
} from "../api/memberships.api";
import { toast } from "react-toastify";

type Tab = "overview" | "memberships" | "payments" | "charges" | "seats";

type AccountStatus = "YET_TO_PAY" | "PARTIAL" | "PAID";

type ModalType = "renew" | "change" | null;

type Student = {
  id: string;
  name: string;
  mobile: string;
  createdAt: string;
};

type MembershipPlan = {
  id: string;
  name: string;
  code: string;
  requiresFixedSeat: boolean;
  isSeatDailyAssigned: boolean;
};

type Shift = {
  id: string;
  name: string;
  code: string;
};

type FixedSeat = {
  id: string;
  seatNumber: number;
  lab?: { id: string; name: string } | null;
};

type ChargeAllocation = {
  id: string;
  amount: number;
  paymentId: string;
};

type MembershipCharge = {
  id: string;
  type: string;
  amountDue: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate: string;
  status: string;
  allocations?: ChargeAllocation[];
};

type Membership = {
  id: string;
  studentId: string;
  membershipPlanId: string;
  membershipPlan?: MembershipPlan | null;
  shiftId: string;
  shift?: Shift | null;
  fixedSeatId?: string | null;
  fixedSeat?: FixedSeat | null;
  startDate: string;
  endDate: string;
  priceSnapshot: number;
  registrationFee: number;
  isActive: boolean;
  charges?: MembershipCharge[];
};

type Payment = {
  id: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  paidOn: string;
};

type SeatAllocation = {
  id: string;
  date: string;
  shift?: Shift | null;
  seat?: { seatNumber: number; lab?: { name: string } | null } | null;
};

type Account = {
  totalDue?: number;
  totalPaid?: number;
  outstanding?: number;
  status?: AccountStatus;
};

type StudentDetailsResponse = {
  student: Student;
  memberships: Membership[];
  payments: Payment[];
  allocations: SeatAllocation[];
  account?: Account;
  activeMembershipId?: string;
};

type ApiErrorShape = {
  response?: { data?: { message?: string | string[] } };
  message?: string;
};

type SelectOption = { id: string; name: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;

  const source = error as ApiErrorShape;
  const message = source.response?.data?.message ?? source.message;

  if (Array.isArray(message)) {
    const text = message.filter(
      (item): item is string => typeof item === "string",
    );
    if (text.length > 0) return text.join(", ");
  }

  return typeof message === "string" && message.trim() ? message : fallback;
}

export default function StudentDetails() {
  const { id } = useParams<{ id: string }>();

  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<ModalType>(null);

  const [renewPaymentAmount, setRenewPaymentAmount] = useState<number | "">("");

  const [renewPaymentMode, setRenewPaymentMode] = useState<
    "CASH" | "UPI" | "CARD"
  >("CASH");

  const [changePlanId, setChangePlanId] = useState("");
  const [changeShiftId, setChangeShiftId] = useState("");
  const [changeStartDate, setChangeStartDate] = useState("");
  const [changeFixedSeatId, setChangeFixedSeatId] = useState("");

  const [changePaymentAmount, setChangePaymentAmount] = useState<number | "">(
    "",
  );

  const [changePaymentMode, setChangePaymentMode] = useState<
    "CASH" | "UPI" | "CARD"
  >("CASH");

  const studentDetailsQuery = useQuery<StudentDetailsResponse>({
    queryKey: ["student-details", id],
    queryFn: () => getStudentDetails(id!),
    enabled: !!id,
  });

  const plansQuery = useQuery({
    queryKey: ["membership-plans"],
    queryFn: getMembershipPlans,
    enabled: modal === "change",
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
    enabled: modal === "change",
  });

  const renewMutation = useMutation({
    mutationFn: renewMembership,

    onSuccess: () => {
      toast.success("Membership renewed successfully");

      setModal(null);
      setRenewPaymentAmount("");

      queryClient.invalidateQueries({
        queryKey: ["student-details", id],
      });

      queryClient.invalidateQueries({
        queryKey: ["students"],
      });

      queryClient.invalidateQueries({
        queryKey: ["student", id],
      });

      queryClient.invalidateQueries({
        queryKey: ["payments"],
      });
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to renew membership"));
    },
  });

  const changeMutation = useMutation({
    mutationFn: changeMembership,

    onSuccess: () => {
      toast.success("Membership changed successfully");

      setModal(null);

      setChangePlanId("");
      setChangeShiftId("");
      setChangeStartDate("");
      setChangeFixedSeatId("");
      setChangePaymentAmount("");

      queryClient.invalidateQueries({
        queryKey: ["student-details", id],
      });

      queryClient.invalidateQueries({
        queryKey: ["students"],
      });

      queryClient.invalidateQueries({
        queryKey: ["student", id],
      });

      queryClient.invalidateQueries({
        queryKey: ["payments"],
      });
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to change membership"));
    },
  });

  if (studentDetailsQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-stone-500">
        Loading student details...
      </div>
    );
  }

  if (studentDetailsQuery.isError || !studentDetailsQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load student details.
        </div>
      </div>
    );
  }

  const {
    student,
    memberships = [],
    payments = [],
    allocations = [],
    account,
    activeMembershipId,
  } = studentDetailsQuery.data;

  const activeMembership =
    memberships.find((membership) => membership.id === activeMembershipId) ??
    memberships.find(
      (membership) =>
        membership.isActive && new Date(membership.endDate) >= new Date(),
    ) ??
    null;

  const openRenewModal = () => {
    setRenewPaymentAmount("");
    setRenewPaymentMode("CASH");
    setModal("renew");
  };

  const openChangeModal = () => {
    if (!activeMembership) {
      toast.info("No active membership");
      return;
    }

    setChangePlanId(
      activeMembership.membershipPlan?.id ??
        activeMembership.membershipPlanId ??
        "",
    );

    setChangeShiftId(
      activeMembership.shift?.id ?? activeMembership.shiftId ?? "",
    );

    const startDate = new Date();

    setChangeStartDate(
      `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(startDate.getDate()).padStart(2, "0")}`,
    );

    setChangeFixedSeatId(activeMembership.fixedSeat?.id ?? "");
    setChangePaymentAmount("");
    setChangePaymentMode("CASH");

    setModal("change");
  };

  const handleRenew = () => {
    if (!id) {
      toast.error("Student ID is missing");
      return;
    }

    if (
      renewPaymentAmount !== "" &&
      (renewPaymentAmount < 0 || !Number.isInteger(renewPaymentAmount))
    ) {
      toast.error("Enter a valid payment amount");
      return;
    }

    renewMutation.mutate({
      studentId: id,
      paymentAmount: renewPaymentAmount === "" ? 0 : renewPaymentAmount,
      paymentMode: renewPaymentMode,
    });
  };

  const handleChange = () => {
    if (!id) {
      toast.error("Student ID is missing");
      return;
    }

    if (!changePlanId) {
      toast.error("Select a membership plan");
      return;
    }

    if (!changeShiftId) {
      toast.error("Select a shift");
      return;
    }

    if (!changeStartDate) {
      toast.error("Select a start date");
      return;
    }

    if (
      changePaymentAmount !== "" &&
      (changePaymentAmount < 0 || !Number.isInteger(changePaymentAmount))
    ) {
      toast.error("Enter a valid payment amount");
      return;
    }

    changeMutation.mutate({
      studentId: id,
      membershipPlanId: changePlanId,
      shiftId: changeShiftId,
      startDate: changeStartDate,
      fixedSeatId: changeFixedSeatId || undefined,
      initialPaymentAmount:
        changePaymentAmount === "" ? 0 : changePaymentAmount,
      paymentMode: changePaymentMode,
    });
  };

  return (
    <div className="space-y-5 bg-stone-50 min-h-full p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-stone-800">
              {student.name}
            </h1>

            <MembershipStatus active={!!activeMembership} />
          </div>

          <p className="mt-1 text-sm text-stone-500">{student.mobile}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeMembership && (
            <>
              <button
                type="button"
                onClick={openRenewModal}
                className="rounded-lg border border-amber-600 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                Renew Membership
              </button>

              <button
                type="button"
                onClick={openChangeModal}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
              >
                Change Membership
              </button>
            </>
          )}

          {activeMembership && (
            <div className="ml-2 text-sm text-stone-500">
              Valid till{" "}
              <span className="font-medium text-stone-700">
                {formatDate(activeMembership.endDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      <AccountSummary account={account} />

      <div className="flex flex-col gap-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <div className="rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
            <NavItem
              label="Overview"
              active={tab === "overview"}
              onClick={() => setTab("overview")}
            />

            <NavItem
              label="Memberships"
              active={tab === "memberships"}
              onClick={() => setTab("memberships")}
            />

            <NavItem
              label="Charges"
              active={tab === "charges"}
              onClick={() => setTab("charges")}
            />

            <NavItem
              label="Payments"
              active={tab === "payments"}
              onClick={() => setTab("payments")}
            />

            <NavItem
              label="Seat History"
              active={tab === "seats"}
              onClick={() => setTab("seats")}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {tab === "overview" && (
            <Overview
              student={student}
              membership={activeMembership}
              account={account}
            />
          )}

          {tab === "memberships" && (
            <MembershipTable memberships={memberships} />
          )}

          {tab === "charges" && <ChargesTable memberships={memberships} />}

          {tab === "payments" && <PaymentsTable payments={payments} />}

          {tab === "seats" && <SeatHistoryTable allocations={allocations} />}
        </main>
      </div>

      {modal === "renew" && (
        <Modal
          title="Renew Membership"
          onClose={() => {
            if (!renewMutation.isPending) {
              setModal(null);
            }
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoItem
                  label="Plan"
                  value={activeMembership?.membershipPlan?.name ?? "—"}
                />

                <InfoItem
                  label="Shift"
                  value={activeMembership?.shift?.name ?? "—"}
                />

                <InfoItem
                  label="Current Valid Till"
                  value={formatDate(activeMembership?.endDate)}
                />

                <InfoItem
                  label="Renewal Amount"
                  value={formatCurrency(activeMembership?.priceSnapshot)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                Payment Amount
              </label>

              <input
                type="number"
                min={0}
                step={1}
                value={renewPaymentAmount}
                onChange={(e) =>
                  setRenewPaymentAmount(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="0"
                className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-lg font-medium text-stone-800 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
              />

              <p className="mt-1 text-xs text-stone-400">
                Enter 0 if the renewal should be recorded without payment.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                Payment Mode
              </label>

              <select
                value={renewPaymentMode}
                onChange={(e) =>
                  setRenewPaymentMode(e.target.value as "CASH" | "UPI" | "CARD")
                }
                className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
              <button
                type="button"
                disabled={renewMutation.isPending}
                onClick={() => setModal(null)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={renewMutation.isPending}
                onClick={handleRenew}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {renewMutation.isPending ? "Renewing..." : "Renew Membership"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "change" && (
        <Modal
          title="Change Membership"
          onClose={() => {
            if (!changeMutation.isPending) {
              setModal(null);
            }
          }}
        >
          <div className="space-y-4">
            {plansQuery.isLoading || shiftsQuery.isLoading ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                Loading membership options...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                      Membership Plan
                    </label>

                    <select
                      value={changePlanId}
                      onChange={(e) => setChangePlanId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                    >
                      <option value="">Select Plan</option>

                      {getArray<MembershipPlan>(plansQuery.data).map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                      Shift
                    </label>

                    <select
                      value={changeShiftId}
                      onChange={(e) => setChangeShiftId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                    >
                      <option value="">Select Shift</option>

                      {getArray<Shift>(shiftsQuery.data).map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                    Start Date
                  </label>

                  <input
                    type="date"
                    value={changeStartDate}
                    onChange={(e) => setChangeStartDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                    Fixed Seat ID
                  </label>

                  <input
                    value={changeFixedSeatId}
                    onChange={(e) => setChangeFixedSeatId(e.target.value)}
                    placeholder="Leave empty when not required"
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                  />

                  <p className="mt-1 text-xs text-stone-400">
                    A fixed-seat plan requires the appropriate seat ID.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                      Initial Payment
                    </label>

                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={changePaymentAmount}
                      onChange={(e) =>
                        setChangePaymentAmount(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="0"
                      className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                      Payment Mode
                    </label>

                    <select
                      value={changePaymentMode}
                      onChange={(e) =>
                        setChangePaymentMode(
                          e.target.value as "CASH" | "UPI" | "CARD",
                        )
                      }
                      className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Changing membership closes the current membership and creates
                  a new membership with the selected configuration.
                </div>

                <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
                  <button
                    type="button"
                    disabled={changeMutation.isPending}
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={changeMutation.isPending}
                    onClick={handleChange}
                    className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {changeMutation.isPending
                      ? "Changing..."
                      : "Change Membership"}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function AccountSummary({ account }: { account?: Account }) {
  const status: AccountStatus = account?.status ?? "YET_TO_PAY";

  const statusConfig = getAccountStatusConfig(status);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AccountCard
        label="Total Due"
        value={formatCurrency(account?.totalDue)}
      />

      <AccountCard
        label="Total Paid"
        value={formatCurrency(account?.totalPaid)}
      />

      <AccountCard
        label="Outstanding"
        value={formatCurrency(account?.outstanding)}
        valueClassName={
          (account?.outstanding ?? 0) > 0 ? "text-red-600" : "text-green-600"
        }
      />

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Account Status
        </div>

        <div className="mt-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${statusConfig.className}`}
          >
            {statusConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  label,
  value,
  valueClassName = "text-stone-800",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>

      <div className={`mt-2 text-xl font-semibold ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function Overview({
  student,
  membership,
  account,
}: {
  student: Student;
  membership: Membership | null;
  account?: Account;
}) {
  return (
    <div className="space-y-5">
      <SectionCard title="Student">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoItem label="Name" value={student.name} />

          <InfoItem label="Mobile" value={student.mobile} />

          <InfoItem label="Created" value={formatDate(student.createdAt)} />
        </div>
      </SectionCard>

      <SectionCard title="Current Membership">
        {!membership ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No active membership.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              label="Plan"
              value={membership.membershipPlan?.name ?? "—"}
            />

            <InfoItem label="Shift" value={membership.shift?.name ?? "—"} />

            <InfoItem
              label="Start Date"
              value={formatDate(membership.startDate)}
            />

            <InfoItem
              label="Valid Till"
              value={formatDate(membership.endDate)}
            />

            <InfoItem
              label="Membership Fee"
              value={formatCurrency(membership.priceSnapshot)}
            />

            <InfoItem
              label="Registration Fee"
              value={formatCurrency(membership.registrationFee)}
            />

            {membership.fixedSeat && (
              <InfoItem
                label="Fixed Seat"
                value={`${membership.fixedSeat.lab?.name ?? "—"} - Seat ${membership.fixedSeat.seatNumber}`}
              />
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Account">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoItem
            label="Total Due"
            value={formatCurrency(account?.totalDue)}
          />

          <InfoItem
            label="Total Paid"
            value={formatCurrency(account?.totalPaid)}
          />

          <InfoItem
            label="Outstanding"
            value={formatCurrency(account?.outstanding)}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function MembershipTable({ memberships }: { memberships: Membership[] }) {
  return (
    <SectionCard title="Membership History">
      {memberships.length === 0 ? (
        <EmptyState text="No memberships found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Shift</th>
                <th className="px-3 py-3">Start</th>
                <th className="px-3 py-3">End</th>
                <th className="px-3 py-3">Fee</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {memberships.map((membership) => (
                <tr
                  key={membership.id}
                  className="border-b border-stone-100 last:border-0"
                >
                  <td className="px-3 py-3 font-medium text-stone-800">
                    {membership.membershipPlan?.name}
                  </td>

                  <td className="px-3 py-3 text-stone-600">
                    {membership.shift?.name}
                  </td>

                  <td className="px-3 py-3 text-stone-600">
                    {formatDate(membership.startDate)}
                  </td>

                  <td className="px-3 py-3 text-stone-600">
                    {formatDate(membership.endDate)}
                  </td>

                  <td className="px-3 py-3 font-medium text-stone-700">
                    {formatCurrency(membership.priceSnapshot)}
                  </td>

                  <td className="px-3 py-3">
                    <MembershipStatus
                      active={
                        membership.isActive &&
                        new Date(membership.endDate) >= new Date()
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ChargesTable({ memberships }: { memberships: Membership[] }) {
  const charges = memberships.flatMap((membership) =>
    (membership.charges ?? []).map((charge) => ({
      ...charge,
      membership,
    })),
  );

  return (
    <SectionCard title="Membership Charges">
      {charges.length === 0 ? (
        <EmptyState text="No charges found." />
      ) : (
        <div className="space-y-3">
          {charges.map((charge) => {
            const amountPaid = (charge.allocations ?? []).reduce(
              (total: number, allocation: ChargeAllocation) =>
                total + Number(allocation.amount ?? 0),
              0,
            );

            const outstanding = Math.max(
              Number(charge.amountDue ?? 0) - amountPaid,
              0,
            );

            const status = getChargeStatus(charge.status, outstanding);

            return (
              <div
                key={charge.id}
                className="rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-stone-800">
                        {charge.type === "REGISTRATION"
                          ? "Registration"
                          : "Membership"}
                      </h3>

                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    {charge.periodStart && charge.periodEnd && (
                      <div className="mt-1 text-xs text-stone-500">
                        {formatDate(charge.periodStart)} →{" "}
                        {formatDate(charge.periodEnd)}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-stone-400">
                      Due {formatDate(charge.dueDate)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-right">
                    <ChargeAmount
                      label="Due"
                      value={Number(charge.amountDue ?? 0)}
                    />

                    <ChargeAmount
                      label="Paid"
                      value={amountPaid}
                      valueClassName="text-green-600"
                    />

                    <ChargeAmount
                      label="Outstanding"
                      value={outstanding}
                      valueClassName={
                        outstanding > 0 ? "text-red-600" : "text-green-600"
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function ChargeAmount({
  label,
  value,
  valueClassName = "text-stone-800",
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-xs text-stone-400">{label}</div>

      <div className={`mt-1 font-semibold ${valueClassName}`}>
        {formatCurrency(value)}
      </div>
    </div>
  );
}

function PaymentsTable({ payments }: { payments: Payment[] }) {
  return (
    <SectionCard title="Payment History">
      {payments.length === 0 ? (
        <EmptyState text="No payments recorded." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Mode</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-stone-100 last:border-0"
                >
                  <td className="px-3 py-3 text-stone-600">
                    {formatDate(payment.paidOn)}
                  </td>

                  <td className="px-3 py-3 font-semibold text-stone-800">
                    {formatCurrency(payment.amount)}
                  </td>

                  <td className="px-3 py-3 text-stone-600">
                    {payment.paymentType}
                  </td>

                  <td className="px-3 py-3 text-stone-600">
                    {payment.paymentMode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function SeatHistoryTable({ allocations }: { allocations: SeatAllocation[] }) {
  return (
    <SectionCard title="Seat History">
      {allocations.length === 0 ? (
        <EmptyState text="No seat allocations found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Shift</th>
                <th className="px-3 py-3">Seat</th>
              </tr>
            </thead>

            <tbody>
              {allocations.map((allocation) => (
                <tr
                  key={allocation.id}
                  className="border-b border-stone-100 last:border-0"
                >
                  <td className="px-3 py-3 text-stone-600">
                    {formatDate(allocation.date)}
                  </td>

                  <td className="px-3 py-3 text-stone-600">
                    {allocation.shift?.name}
                  </td>

                  <td className="px-3 py-3 font-medium text-stone-700">
                    {allocation.seat?.lab?.name ?? "—"} - Seat{" "}
                    {allocation.seat?.seatNumber ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-stone-800">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ×
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-stone-800">{title}</h2>

      {children}
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-stone-700">{value}</div>
    </div>
  );
}

function NavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-amber-100 font-medium text-amber-800"
          : "text-stone-600 hover:bg-stone-100"
      }`}
    >
      {label}
    </button>
  );
}

function MembershipStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
        active
          ? "border-green-200 bg-green-100 text-green-700"
          : "border-red-200 bg-red-100 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-center text-sm text-stone-500">
      {text}
    </div>
  );
}

function formatCurrency(amount?: number) {
  return `₹${Number(amount ?? 0).toLocaleString("en-IN")}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getAccountStatusConfig(status: AccountStatus) {
  switch (status) {
    case "PAID":
      return {
        label: "Paid",
        className: "border-green-200 bg-green-100 text-green-700",
      };

    case "PARTIAL":
      return {
        label: "Partial",
        className: "border-amber-200 bg-amber-100 text-amber-700",
      };

    case "YET_TO_PAY":
    default:
      return {
        label: "Yet to Pay",
        className: "border-red-200 bg-red-100 text-red-700",
      };
  }
}

function getChargeStatus(status: string, outstanding: number) {
  if (status === "CANCELLED") {
    return {
      label: "Cancelled",
      className: "border-stone-200 bg-stone-100 text-stone-500",
    };
  }

  if (outstanding <= 0) {
    return {
      label: "Paid",
      className: "border-green-200 bg-green-100 text-green-700",
    };
  }

  if (status === "PARTIAL") {
    return {
      label: "Partial",
      className: "border-amber-200 bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Pending",
    className: "border-red-200 bg-red-100 text-red-700",
  };
}

function getArray<T extends SelectOption>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value.filter(isSelectOption) as T[];
  }

  if (typeof value === "object" && value !== null) {
    const source = value as {
      data?: unknown;
      plans?: unknown;
      shifts?: unknown;
    };

    for (const candidate of [source.data, source.plans, source.shifts]) {
      if (Array.isArray(candidate)) {
        return candidate.filter(isSelectOption) as T[];
      }
    }
  }

  return [];
}

function isSelectOption(value: unknown): value is SelectOption {
  if (typeof value !== "object" || value === null) return false;
  const source = value as { id?: unknown; name?: unknown };
  return typeof source.id === "string" && typeof source.name === "string";
}
