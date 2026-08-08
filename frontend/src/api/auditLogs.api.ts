import api from "./axios";

export const getAuditLogs = async ({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) => {
  const res = await api.get("/audit-logs", {
    params: { page, limit },
  });
  return res.data;
};

export const rollbackAudit = async (auditId: string) => {
  const res = await api.post(`/audit-logs/${auditId}/rollback`);
  return res.data;
};
