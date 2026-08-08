import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getPayments } from "../api/payment.api";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";

type Props = {
  highlightPaymentId?: string | null;
  emptyFallback?: React.ReactNode;
};

export default function PaymentList({
  highlightPaymentId,
  emptyFallback,
}: Props) {
  /* =======================
     STATE (ALWAYS FIRST)
  ======================= */
  const [page, setPage] = useState(1);
  const [paymentType, setPaymentType] = useState("");
  const limit = 10;

  /* =======================
     QUERY
  ======================= */
  const paymentsQuery = useQuery({
    queryKey: ["payments", page, paymentType],
    queryFn: () =>
      getPayments(page, limit, {
        paymentType: paymentType || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  /* =======================
     DERIVED DATA (HOOKS FIRST)
  ======================= */
  const data = paymentsQuery.data?.data ?? [];
  const pagination = paymentsQuery.data?.pagination;

  const pages = useMemo(() => {
    if (!pagination) return [];
    return Array.from({ length: pagination.totalPages }, (_, i) => i + 1);
  }, [pagination]);

  /* =======================
     HELPERS
  ======================= */
  const formatIST = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const exportCSV = () => {
    const rows = [
      ["Name", "Mobile", "Amount", "Type", "Mode", "Date & Time (IST)"],
      ...data.map((p: any) => [
        p.student?.name ?? "—",
        p.student?.mobile ?? "—",
        p.amount,
        p.paymentType,
        p.paymentMode,
        formatIST(p.paidOn),
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "payments.csv";
    a.click();
  };

  const printPage = () => {
    if (!pagination) return;

    const html = `
      <html>
        <head>
          <title>Payments</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h3>Payments – Page ${pagination.page}</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Date (IST)</th>
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (p: any) => `
                <tr>
                  <td>${p.student?.name ?? "—"}</td>
                  <td>${p.student?.mobile ?? "—"}</td>
                  <td>${p.amount}</td>
                  <td>${p.paymentType}</td>
                  <td>${p.paymentMode}</td>
                  <td>${formatIST(p.paidOn)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    win!.document.write(html);
    win!.document.close();
    win!.print();
  };

  /* =======================
     RENDER (NO HOOKS BELOW)
  ======================= */

  if (paymentsQuery.isLoading) {
    return (
      <div className="text-sm text-stone-500 italic">Loading payments…</div>
    );
  }

  if (data.length === 0) {
    return <>{emptyFallback ?? null}</>;
  }

  return (
    <div className="space-y-4">
      {/* FILTER + ACTIONS */}
      <div className="flex items-center justify-between">
        <select
          className="h-8 rounded-md border border-stone-300 bg-white px-2 text-sm"
          value={paymentType}
          onChange={(e) => {
            setPage(1);
            setPaymentType(e.target.value);
          }}
        >
          <option value="">All Payments</option>
          <option value="REGISTRATION">Registration</option>
          <option value="MONTHLY">Monthly</option>
          <option value="ADVANCE">Advance</option>
          <option value="PARTIAL">Partial</option>
        </select>

        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 text-sm hover:bg-stone-200"
          >
            <Download size={14} /> Export
          </button>

          <button
            onClick={printPage}
            className="flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 text-sm hover:bg-stone-200"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* LEDGER */}
      <div className="max-h-[520px] overflow-y-auto space-y-2">
        {data.map((p: any) => {
          const isNew = p.id === highlightPaymentId;

          return (
            <div
              key={p.id}
              className={[
                "flex justify-between rounded-xl border bg-white px-4 py-3",
                "border-stone-200 hover:bg-amber-50/40 transition",
                isNew ? "animate-slide-down ring-2 ring-amber-200" : "",
              ].join(" ")}
            >
              <div>
                <div className="font-medium text-stone-800">
                  {p.student?.name ?? "—"}
                </div>
                <div className="text-xs text-stone-500">
                  {p.paymentType} • {p.paymentMode} • {formatIST(p.paidOn)}
                </div>
              </div>

              <div className="text-lg font-semibold text-stone-800">
                ₹{p.amount}
              </div>
            </div>
          );
        })}
      </div>

      {/* PAGINATION */}
      <div className="flex justify-center items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-md border px-2 py-1 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`h-8 w-8 rounded-md border text-sm ${
              p === page
                ? "bg-amber-600 text-white border-amber-600"
                : "border-stone-300"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          disabled={page === pagination!.totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border px-2 py-1 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
