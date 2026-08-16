import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";

import { getPayments } from "../api/payment.api";

type Props = {
  highlightPaymentId?: string | null;
  emptyFallback?: React.ReactNode;
};

type Payment = {
  id: string;
  amount: number | string;
  paymentType?: string | null;
  paymentMode?: string | null;
  paidOn?: string | null;
  student?: {
    name?: string | null;
    mobile?: string | null;
  } | null;
  allocations?: unknown[];
};

type PaymentResponse = {
  data?: Payment[];
  pagination?: {
    page?: number;
    totalPages?: number;
    total?: number;
  };
};

const PAGE_SIZE = 10;

const PAYMENT_TYPE_OPTIONS = [
  { value: "", label: "All Payments" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "MEMBERSHIP_PAYMENT", label: "Membership" },
] as const;

const escapeHtml = (value: unknown) =>
  String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatIST = (iso?: string | null) => {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPaymentType = (type?: string | null) => {
  switch (type) {
    case "REGISTRATION":
      return "Registration";
    case "MEMBERSHIP_PAYMENT":
    case "MONTHLY":
    case "ADVANCE":
    case "PARTIAL":
      return "Membership";
    default:
      return type || "—";
  }
};

const formatAmount = (amount: unknown) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "0";

  return numericAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export default function PaymentList({
  highlightPaymentId,
  emptyFallback,
}: Props) {
  const [page, setPage] = useState(1);
  const [paymentType, setPaymentType] = useState("");

  const paymentsQuery = useQuery<PaymentResponse>({
    queryKey: ["payments", page, paymentType],
    queryFn: () =>
      getPayments(page, PAGE_SIZE, {
        paymentType: paymentType || undefined,
      }),
    placeholderData: (previousData) => previousData,
    staleTime: 15_000,
    retry: 2,
  });

  const data = Array.isArray(paymentsQuery.data?.data)
    ? paymentsQuery.data.data
    : [];

  const pagination = paymentsQuery.data?.pagination;

  const totalPages = Math.max(
    1,
    Number.isFinite(Number(pagination?.totalPages))
      ? Number(pagination?.totalPages)
      : 1,
  );

  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pages = useMemo(() => {
    if (totalPages <= 1) return [];

    // Avoid rendering hundreds/thousands of page buttons.
    const maxVisiblePages = 7;
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(
      1,
      Math.min(safePage - 3, totalPages - maxVisiblePages + 1),
    );

    return Array.from({ length: maxVisiblePages }, (_, index) => start + index);
  }, [safePage, totalPages]);

  const exportCSV = () => {
    if (!data.length) return;

    const rows = [
      ["Name", "Mobile", "Amount", "Type", "Mode", "Date & Time (IST)"],
      ...data.map((payment) => [
        payment.student?.name ?? "—",
        payment.student?.mobile ?? "—",
        formatAmount(payment.amount),
        formatPaymentType(payment.paymentType),
        payment.paymentMode ?? "—",
        formatIST(payment.paidOn),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = url;
      anchor.download = `payments-page-${safePage}.csv`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  };

  const printPage = () => {
    if (!data.length || !pagination) return;

    const rowsHtml = data
      .map(
        (payment) => `
          <tr>
            <td>${escapeHtml(payment.student?.name)}</td>
            <td>${escapeHtml(payment.student?.mobile)}</td>
            <td>₹${escapeHtml(formatAmount(payment.amount))}</td>
            <td>${escapeHtml(formatPaymentType(payment.paymentType))}</td>
            <td>${escapeHtml(payment.paymentMode)}</td>
            <td>${escapeHtml(formatIST(payment.paidOn))}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payments - Page ${safePage}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #292524;
            }
            h3 { margin: 0 0 16px; }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #d6d3d1;
              padding: 8px;
              font-size: 12px;
              text-align: left;
            }
            th { background: #f5f5f4; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h3>Payments — Page ${safePage}</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      // Give the browser a frame to finish laying out the document before printing.
      window.setTimeout(() => {
        try {
          printWindow.print();
        } finally {
          // Closing after print is browser-dependent; afterprint is handled below.
        }
      }, 50);

      const closePrintWindow = () => {
        try {
          printWindow.close();
        } catch {
          // Ignore browser-specific close errors.
        }
      };

      printWindow.addEventListener("afterprint", closePrintWindow, {
        once: true,
      });

      // Fallback for browsers that do not fire afterprint on the popup.
      window.setTimeout(closePrintWindow, 60_000);
    } catch {
      try {
        printWindow.close();
      } catch {
        // Ignore browser-specific close errors.
      }
    }
  };

  if (paymentsQuery.isLoading && !paymentsQuery.data) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 size={16} className="animate-spin" />
          Loading payments...
        </div>
      </div>
    );
  }

  if (paymentsQuery.isError && !paymentsQuery.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-red-800">
              Failed to load payments.
            </p>
            <p className="mt-1 text-xs text-red-600">
              Please try again. Existing payment data is not modified.
            </p>
          </div>

          <button
            type="button"
            onClick={() => paymentsQuery.refetch()}
            disabled={paymentsQuery.isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={paymentsQuery.isFetching ? "animate-spin" : ""}
            />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <select
            aria-label="Filter payments by type"
            className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-700 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100 sm:w-auto"
            value={paymentType}
            onChange={(e) => {
              setPage(1);
              setPaymentType(e.target.value);
            }}
          >
            {PAYMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {emptyFallback ?? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
            No payments found.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="Filter payments by type"
            className="h-9 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-700 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100 sm:w-auto sm:flex-none"
            value={paymentType}
            onChange={(e) => {
              setPage(1);
              setPaymentType(e.target.value);
            }}
          >
            {PAYMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {paymentsQuery.isFetching && (
            <Loader2
              size={15}
              className="shrink-0 animate-spin text-stone-400"
              aria-label="Refreshing payments"
            />
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCSV}
            disabled={!data.length}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={printPage}
            disabled={!data.length}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-0.5">
        {data.map((payment) => {
          const isNew = payment.id === highlightPaymentId;

          return (
            <div
              key={payment.id}
              className={[
                "flex flex-col gap-2 rounded-xl border bg-white px-3 py-3 transition sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
                "border-stone-200 hover:bg-amber-50/40",
                isNew ? "animate-slide-down ring-2 ring-amber-200" : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-stone-800">
                  {payment.student?.name ?? "Unknown student"}
                </div>

                <div className="text-xs text-stone-500">
                  {payment.student?.mobile ?? "—"}
                </div>

                <div className="mt-1 text-xs leading-5 text-stone-500">
                  {formatPaymentType(payment.paymentType)}{" "}
                  <span aria-hidden="true">•</span> {payment.paymentMode ?? "—"}{" "}
                  <span aria-hidden="true">•</span> {formatIST(payment.paidOn)}
                </div>

                {Array.isArray(payment.allocations) &&
                  payment.allocations.length > 0 && (
                    <div className="mt-1.5 text-xs text-stone-400">
                      Allocated across {payment.allocations.length} charge
                      {payment.allocations.length !== 1 ? "s" : ""}
                    </div>
                  )}
              </div>

              <div className="shrink-0 text-left text-base font-semibold text-stone-800 sm:text-right sm:text-lg">
                ₹{formatAmount(payment.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={safePage <= 1 || paymentsQuery.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>

          {pages.map((pageNumber) => (
            <button
              type="button"
              key={pageNumber}
              aria-current={pageNumber === safePage ? "page" : undefined}
              onClick={() => setPage(pageNumber)}
              disabled={paymentsQuery.isFetching}
              className={[
                "h-8 min-w-8 rounded-md border px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                pageNumber === safePage
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100",
              ].join(" ")}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            aria-label="Next page"
            disabled={safePage >= totalPages || paymentsQuery.isFetching}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
