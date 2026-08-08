import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuditLogs, rollbackAudit } from "../api/auditLogs.api";
import { toast } from "react-toastify";
import { useState, useMemo } from "react";
import { RotateCcw, Eye } from "lucide-react";

const PAGE_SIZE = 10;

/* ---------------- TYPES ---------------- */

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
  rolledBack?: boolean;
};

type AuditLogResponse = {
  page: number;
  limit: number;
  total: number;
  data: AuditLog[];
};

/* ---------------- COMPONENT ---------------- */

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", page],
    queryFn: () => getAuditLogs({ page, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const rollbackMutation = useMutation({
    mutationFn: rollbackAudit,
    onSuccess: () => {
      toast.success("Rollback successful");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Rollback failed");
    },
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        log.actorName?.toLowerCase().includes(q),
    );
  }, [logs, search]);

  if (isLoading) {
    return <p className="text-sm text-stone-500">Loading audit logs…</p>;
  }

  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HEADER */}
        <h1 className="text-lg font-semibold text-stone-800">Audit Logs</h1>

        {/* SEARCH */}
        <div className="flex justify-between items-center">
          <input
            className="w-64 h-9 rounded-md border border-stone-300 bg-white px-3"
            placeholder="Search logs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <span className="text-sm text-stone-500">
            Showing {filteredLogs.length} of {total}
          </span>
        </div>

        {/* TABLE */}
        <div className="bg-stone-100/80 border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-200/60 text-stone-700">
              <tr>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Entity</th>
                <th className="p-3 text-left">Actor</th>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t hover:bg-amber-50/40 transition"
                >
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.entity}</td>
                  <td className="p-3 text-stone-600">ADMIN</td>
                  <td className="p-3 text-stone-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {log.rolledBack ? (
                      <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
                        Rolled Back
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="p-3 flex gap-3 items-center">
                    <Eye size={16} className="text-stone-500" />

                    {/* {!log.rolledBack && (
                      <button
                        onClick={() => {
                          if (confirm("Rollback this action?")) {
                            rollbackMutation.mutate(log.id);
                          }
                        }}
                        className="text-amber-700 hover:text-amber-800"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )} */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 px-3 border rounded-md disabled:opacity-50"
            >
              Prev
            </button>

            <span className="text-sm text-stone-600">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 px-3 border rounded-md disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
