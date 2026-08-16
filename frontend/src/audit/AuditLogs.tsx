import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";

import { getAuditLogs } from "../api/auditLogs.api";

const PAGE_SIZE = 20;

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  description?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  actorId?: string | null;
  createdAt: string;
  meta?: Record<string, unknown>;
  isRollback?: boolean;
  rolledBackFrom?: string | null;
  originalAction?: string | null;
};

type AuditLogResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  data: AuditLog[];
};

type FilterOption = {
  value: string;
  label: string;
};

const ACTION_OPTIONS: FilterOption[] = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "PAYMENT_CREATED", label: "Payment created" },
  { value: "MEMBERSHIP_CREATED", label: "Membership created" },
  { value: "MEMBERSHIP_UPDATED", label: "Membership updated" },
  { value: "SEAT_ASSIGNED", label: "Seat assigned" },
  { value: "SEAT_CHANGED", label: "Seat changed" },
  { value: "SEAT_RELEASED", label: "Seat released" },
  { value: "STUDENT_CREATED", label: "Student created" },
  { value: "STUDENT_UPDATED", label: "Student updated" },
  { value: "AUDIT_ROLLBACK", label: "Rollback recorded" },
];

const ENTITY_OPTIONS: FilterOption[] = [
  { value: "", label: "All entities" },
  { value: "Student", label: "Students" },
  { value: "Membership", label: "Memberships" },
  { value: "Payment", label: "Payments" },
  { value: "Seat", label: "Seats" },
  { value: "DailySeatAllocation", label: "Seat allocations" },
  { value: "Shift", label: "Shifts" },
  { value: "Lab", label: "Labs" },
];

const humanize = (value?: string | null): string => {
  if (!value) {
    return "—";
  }

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to display value";
  }
};

const actionTone = (action: string): string => {
  const normalized = action.toUpperCase();

  if (
    normalized.includes("DELETE") ||
    normalized.includes("CANCEL") ||
    normalized.includes("FAIL")
  ) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (
    normalized.includes("PAYMENT") ||
    normalized.includes("CREATE") ||
    normalized.includes("ASSIGN")
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (
    normalized.includes("UPDATE") ||
    normalized.includes("CHANGE") ||
    normalized.includes("RELEASE")
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-stone-100 text-stone-600 ring-stone-200";
};

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const auditQuery = useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", page, action, entity],
    queryFn: () =>
      getAuditLogs({
        page,
        limit: PAGE_SIZE,
        action: action || undefined,
        entity: entity || undefined,
      }),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
    retry: 2,
  });

  const logs = Array.isArray(auditQuery.data?.data) ? auditQuery.data.data : [];

  const total = Number(auditQuery.data?.total ?? 0);

  const totalPages = Math.max(
    1,
    Number(auditQuery.data?.totalPages ?? Math.ceil(total / PAGE_SIZE)),
  );

  /*
   * Search is intentionally performed on the current server
   * page only. Pagination and action/entity filtering remain
   * server-side.
   */
  const query = search.trim().toLowerCase();

  const filteredLogs = query
    ? logs.filter((log) =>
        [
          log.action,
          log.entity,
          log.entityId,
          log.actorName,
          log.actorRole,
          log.description,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
    : logs;

  const clearFilters = () => {
    setSearch("");
    setAction("");
    setEntity("");
    setPage(1);
  };

  const hasFilters = Boolean(search || action || entity);

  if (auditQuery.isLoading && !auditQuery.data) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (auditQuery.isError && !auditQuery.data) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 shrink-0 text-red-600" size={20} />

            <div className="min-w-0">
              <h2 className="font-medium text-red-800">
                Failed to load audit logs
              </h2>

              <p className="mt-1 text-sm text-red-700">
                The audit history could not be loaded. No audit data was
                changed.
              </p>

              <button
                type="button"
                onClick={() => {
                  void auditQuery.refetch();
                }}
                disabled={auditQuery.isFetching}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={auditQuery.isFetching ? "animate-spin" : ""}
                />
                Retry
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* HEADER */}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">
              Audit Logs
            </h1>

            <p className="mt-1 text-sm text-stone-500">
              Review important administrative activity, who performed it, what
              changed, and when it happened.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-500">
          {auditQuery.isFetching && (
            <Loader2 size={14} className="animate-spin" />
          )}

          <span>{total.toLocaleString("en-IN")} total events</span>
        </div>
      </div>

      {/* FILTER BAR */}

      <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-100/80 p-3 sm:p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
          <Filter size={14} />
          Filters
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search action, entity, actor or description"
            className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          />

          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          >
            {ENTITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              <X size={14} />
              Clear
            </button>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>

      {/* MOBILE/TABLET CARDS */}

      <div className="space-y-2 lg:hidden">
        {filteredLogs.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          filteredLogs.map((log) => (
            <AuditCard
              key={log.id}
              log={log}
              onView={() => setSelectedLog(log)}
            />
          ))
        )}
      </div>

      {/* DESKTOP TABLE */}

      <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-stone-100/80 text-stone-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Activity</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Actor</th>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-right font-medium">Details</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState hasFilters={hasFilters} />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-stone-100 transition hover:bg-amber-50/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-stone-100 p-2 text-stone-500">
                          <Activity size={15} />
                        </div>

                        <div className="min-w-0">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${actionTone(
                              log.action,
                            )}`}
                          >
                            {humanize(log.action)}
                          </span>

                          <p className="mt-1 max-w-[360px] truncate text-xs text-stone-500">
                            {log.description || "No description recorded."}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-stone-700">
                        {humanize(log.entity)}
                      </div>

                      <div className="mt-0.5 max-w-[180px] truncate font-mono text-[10px] text-stone-400">
                        {log.entityId || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <UserRound size={15} className="text-stone-400" />

                        <div>
                          <div className="font-medium text-stone-700">
                            {log.actorName || "System"}
                          </div>

                          <div className="text-[11px] text-stone-400">
                            {log.actorRole || "SYSTEM"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-stone-500">
                      <div className="flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {formatDateTime(log.createdAt)}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER / PAGINATION */}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-stone-500">
          Showing {filteredLogs.length} events on page {page} of {totalPages}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || auditQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 text-sm text-stone-600">
              Page {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || auditQuery.isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {selectedLog && (
        <AuditDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-stone-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Loader2 size={16} className="animate-spin" />
        Loading audit history...
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
      <div className="rounded-full bg-stone-100 p-3 text-stone-400">
        <Database size={20} />
      </div>

      <p className="mt-3 text-sm font-medium text-stone-700">
        {hasFilters ? "No matching audit events" : "No audit events yet"}
      </p>

      <p className="mt-1 text-xs text-stone-500">
        {hasFilters
          ? "Try changing the search or filters."
          : "Administrative activity will appear here when it is recorded."}
      </p>
    </div>
  );
}

function AuditCard({ log, onView }: { log: AuditLog; onView: () => void }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-stone-100 p-2 text-stone-500">
            <Activity size={15} />
          </div>

          <div className="min-w-0">
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${actionTone(
                log.action,
              )}`}
            >
              {humanize(log.action)}
            </span>

            <p className="mt-1.5 text-sm text-stone-700">
              {log.description || "No description recorded."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onView}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          <Eye size={13} />
          View
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-stone-100 pt-3 text-xs">
        <div>
          <div className="text-stone-400">Entity</div>

          <div className="mt-0.5 font-medium text-stone-700">
            {humanize(log.entity)}
          </div>
        </div>

        <div>
          <div className="text-stone-400">Actor</div>

          <div className="mt-0.5 font-medium text-stone-700">
            {log.actorName || "System"}
          </div>
        </div>

        <div className="col-span-2">
          <div className="text-stone-400">Time</div>

          <div className="mt-0.5 text-stone-600">
            {formatDateTime(log.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditDetails({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  const metaEntries = Object.entries(log.meta ?? {}).filter(
    ([key]) =>
      !["actorId", "actorName", "actorRole", "description"].includes(key),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Audit event details"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-stone-200 p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <ShieldCheck size={18} />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-stone-800">
                {humanize(log.action)}
              </h2>

              <p className="mt-1 text-xs text-stone-500">
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-sm leading-6 text-stone-700">
              {log.description || "No description recorded."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem label="Action" value={humanize(log.action)} />

            <DetailItem label="Entity" value={humanize(log.entity)} />

            <DetailItem label="Entity ID" value={log.entityId} mono />

            <DetailItem label="Actor" value={log.actorName || "System"} />

            <DetailItem label="Role" value={log.actorRole || "SYSTEM"} />

            <DetailItem label="Created" value={formatDateTime(log.createdAt)} />
          </div>

          {log.isRollback && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              This event records a rollback request/event. It does not by itself
              prove that the original business transaction was reversed.
            </div>
          )}

          {metaEntries.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-stone-600">
                Recorded details
              </div>

              <div className="overflow-hidden rounded-xl border border-stone-200">
                {metaEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-1 gap-1 border-b border-stone-100 p-3 last:border-b-0 sm:grid-cols-[160px_1fr]"
                  >
                    <div className="text-xs font-medium text-stone-500">
                      {humanize(key)}
                    </div>

                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-stone-700">
                      {formatValue(value)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-[11px] text-stone-400">{label}</div>

      <div
        className={`mt-1 break-words text-sm font-medium text-stone-700 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
