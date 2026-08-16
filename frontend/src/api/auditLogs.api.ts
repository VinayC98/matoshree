import api from "./axios";

export type AuditLogQuery = {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
  isRollback?: boolean;
  rolledBackFrom?: string | null;
  originalAction?: string | null;
};

export type AuditLogResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: AuditLog[];
};

/*
 * Keep the same HTTP client/import already used by the project.
 *
 * If your existing api client is named differently, replace only this
 * import and leave the function below unchanged.
 */

export async function getAuditLogs(
  params: AuditLogQuery = {},
): Promise<AuditLogResponse> {
  const response = await api.get<AuditLogResponse>("/audit-logs", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...(params.action ? { action: params.action } : {}),
      ...(params.entity ? { entity: params.entity } : {}),
    },
  });

  return response.data;
}
