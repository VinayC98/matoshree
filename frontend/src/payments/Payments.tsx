import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { getStudents, getStudentById } from "../api/students.api";
import { createPayment } from "../api/payment.api";
import PaymentList from "./PaymentsList";
import { toast } from "react-toastify";

type PaymentType = "REGISTRATION" | "MONTHLY" | "ADVANCE" | "PARTIAL";

export default function Payments() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("MONTHLY");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD">(
    "CASH",
  );
  const [extendMembership, setExtendMembership] = useState(false);
  const [extendMonths, setExtendMonths] = useState(1);
  const [lastAddedPaymentId, setLastAddedPaymentId] = useState<string | null>(
    null,
  );

  /* =======================
     DATA FETCH
  ======================= */

  const studentsQuery = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  const studentQuery = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: !!studentId,
  });

  /* =======================
     DERIVED MEMBERSHIP
  ======================= */

  const activeMembership = useMemo(() => {
    return studentQuery.data?.memberships?.find(
      (m: any) => m.isActive === true,
    );
  }, [studentQuery.data]);

  /* =======================
     AUTO-FILL AMOUNT
  ======================= */

  useEffect(() => {
    if (!activeMembership) return;

    if (paymentType === "REGISTRATION")
      setAmount(activeMembership.registrationFee);
    else if (paymentType === "MONTHLY")
      setAmount(activeMembership.priceSnapshot);
    else if (paymentType === "ADVANCE")
      setAmount(activeMembership.priceSnapshot * 2);
    else setAmount("");
  }, [paymentType, activeMembership]);

  /* =======================
     MUTATION
  ======================= */

  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: (payment) => {
      toast.success("Payment recorded");
      setAmount("");
      setLastAddedPaymentId(payment.id);
      queryClient.invalidateQueries({ queryKey: ["payments"] });

      setTimeout(() => setLastAddedPaymentId(null), 1200);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Payment failed");
    },
  });

  /* =======================
     FILTER STUDENTS
  ======================= */

  const filteredStudents = useMemo(() => {
    if (!studentsQuery.data) return [];
    return studentsQuery.data.filter((s: any) =>
      `${s.name} ${s.mobile}`.toLowerCase().includes(search.toLowerCase()),
    );
  }, [studentsQuery.data, search]);

  /* =======================
     SUBMIT
  ======================= */

  const handleSubmit = () => {
    if (!activeMembership) return toast.info("No active membership");

    if (amount === "" || amount < 1) return toast.error("Enter valid amount");

    mutation.mutate({
      membershipId: activeMembership.id,
      amount,
      paymentMode,
      paymentType,
      extendMembership,
      extendMonths: extendMembership ? extendMonths : undefined,
    });
  };

  /* =======================
     RENDER
  ======================= */

  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT — PAYMENT FORM */}
          <div className="lg:col-span-1">
            <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-5 shadow-sm">
              <h1 className="text-lg font-semibold text-stone-800 mb-4">
                Add Payment
              </h1>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                className="space-y-3 text-sm"
              >
                <input
                  className="w-full h-9 rounded-md border border-stone-300 bg-white px-3"
                  placeholder="Search by name or mobile"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="w-full h-9 rounded-md border border-stone-300 bg-white px-2"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select Student</option>
                  {filteredStudents.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.mobile})
                    </option>
                  ))}
                </select>

                {activeMembership && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        className="h-8 rounded-md border border-stone-300 bg-white px-2"
                        value={paymentType}
                        onChange={(e) =>
                          setPaymentType(e.target.value as PaymentType)
                        }
                      >
                        <option value="REGISTRATION">Registration</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="ADVANCE">Advance</option>
                        <option value="PARTIAL">Partial</option>
                      </select>

                      <select
                        className="h-8 rounded-md border border-stone-300 bg-white px-2"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as any)}
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                      </select>
                    </div>

                    {/* AMOUNT — PRIMARY */}
                    <input
                      type="number"
                      className="w-full h-11 rounded-xl border border-stone-300 bg-white px-4 text-lg font-medium focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                      value={amount}
                      onChange={(e) =>
                        setAmount(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />

                    {paymentType !== "REGISTRATION" && (
                      <label className="flex items-center gap-2 text-stone-700">
                        <input
                          type="checkbox"
                          checked={extendMembership}
                          onChange={(e) =>
                            setExtendMembership(e.target.checked)
                          }
                        />
                        Extend membership
                      </label>
                    )}

                    {extendMembership && (
                      <input
                        type="number"
                        min={1}
                        className="w-32 h-9 rounded-md border border-stone-300 bg-white px-3"
                        value={extendMonths}
                        onChange={(e) =>
                          setExtendMonths(Number(e.target.value))
                        }
                        placeholder="Months"
                      />
                    )}

                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="mt-2 h-9 rounded-md bg-amber-700 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
                    >
                      {mutation.isPending ? "Saving…" : "Save Payment"}
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>

          {/* RIGHT — PAYMENT LEDGER */}
          <div className="lg:col-span-2">
            <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-5 shadow-sm h-full">
              <h2 className="text-lg font-semibold text-stone-800 mb-4">
                Recent Payments
              </h2>

              <PaymentList
                highlightPaymentId={lastAddedPaymentId}
                emptyFallback={
                  <div className="text-sm text-stone-500 italic">
                    No payments recorded yet.
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
