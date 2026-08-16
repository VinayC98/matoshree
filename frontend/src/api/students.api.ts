import api from "./axios";
/* =========================================================
   TYPES
========================================================= */

export type StudentOption = {
  id: string;
  name: string;
  mobile: string;

  hasActiveMembership: boolean;

  paymentStatus: "YET_TO_PAY" | "PARTIAL" | "PAID";

  account: {
    totalDue: number;
    totalPaid: number;
    outstanding: number;
  };

  activeMembership: {
    id: string;

    startDate: string;
    endDate: string;

    plan: {
      id: string;
      code: string;
      name: string;
    };

    planId: string;

    shift: {
      id: string;
      code: string;
      name: string;
    };

    shiftId: string;
  } | null;
};

/**
 * Get all students
 */
export async function getStudents() {
  const res = await api.get("/students");
  return res.data;
}

/**
 * Get single student by ID
 *
 * Includes memberships & relations
 * (backend controlled)
 */
export async function getStudentById(studentId: string) {
  if (!studentId) {
    throw new Error("Student ID is required");
  }

  const res = await api.get(`/students/${studentId}`);

  return res.data;
}

/**
 * Create student
 */
export async function createStudent(payload: { name: string; mobile: string }) {
  const res = await api.post("/students", payload);

  return res.data;
}

/**
 * Get students with pagination
 *
 * Existing Students page API.
 *
 * DO NOT change the response handling here.
 */
export const getStudentsByLimit = async ({
  page,
  limit,
  search = "",
}: {
  page: number;
  limit: number;
  search?: string;
}) => {
  const response = await api.get("/students", {
    params: {
      page,
      limit,
      search,
    },
  });

  return response.data;
};

/* =========================================================
   STUDENT OPTIONS
========================================================= */

/**
 * Get student options.
 *
 * Kept for existing consumers.
 *
 * Returns an array in all cases so existing:
 *
 *   data.map(...)
 *
 * code does not break.
 */
export async function getStudentOptions(): Promise<StudentOption[]> {
  const res = await api.get("/students/options");

  const data = res.data;

  /*
   * Normal API response:
   *
   * [
   *   {...},
   *   {...}
   * ]
   */
  if (Array.isArray(data)) {
    return data as StudentOption[];
  }

  /*
   * Defensive support:
   *
   * {
   *   data: [...]
   * }
   */
  if (Array.isArray(data?.data)) {
    return data.data as StudentOption[];
  }

  /*
   * Defensive support:
   *
   * {
   *   students: [...]
   * }
   */
  if (Array.isArray(data?.students)) {
    return data.students as StudentOption[];
  }

  /*
   * Always return an array.
   */
  return [];
}

/**
 * Search students for Membership flow.
 *
 * Supports:
 *
 *   search=raj
 *   limit=10
 *   hasActiveMembership=true
 *
 * NEW MEMBERSHIP:
 *
 *   hasActiveMembership=false
 *
 * RENEW / CHANGE:
 *
 *   hasActiveMembership=true
 */
export async function searchStudentOptions(params: {
  search?: string;
  limit?: number;
  hasActiveMembership?: boolean;
}): Promise<StudentOption[]> {
  const queryParams: Record<string, string | number | boolean> = {
    search: params.search?.trim() ?? "",

    limit: params.limit ?? 10,
  };

  /*
   * Only send the filter when explicitly
   * provided.
   */
  if (params.hasActiveMembership !== undefined) {
    queryParams.hasActiveMembership = params.hasActiveMembership;
  }

  const res = await api.get("/students/options", {
    params: queryParams,
  });

  const data = res.data;

  /*
   * Normal API response:
   *
   * [
   *   {...}
   * ]
   */
  if (Array.isArray(data)) {
    return data as StudentOption[];
  }

  /*
   * Defensive support for:
   *
   * {
   *   data: [...]
   * }
   */
  if (Array.isArray(data?.data)) {
    return data.data as StudentOption[];
  }

  /*
   * Defensive support for:
   *
   * {
   *   students: [...]
   * }
   */
  if (Array.isArray(data?.students)) {
    return data.students as StudentOption[];
  }

  /*
   * Never return an object to the UI.
   *
   * This prevents:
   *
   * data.map is not a function
   */
  return [];
}

/**
 * Get audit logs
 */
export const getAuditLogs = async ({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) => {
  const res = await api.get("/audit-logs", {
    params: {
      page,
      limit,
    },
  });

  return res.data;
};

/**
 * Get student details
 */
export const getStudentDetails = async (id: string) => {
  const res = await api.get(`/students/${id}/details`);

  return res.data;
};
