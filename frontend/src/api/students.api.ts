import api from "./axios";

/**
 * Get all students
 */
export async function getStudents() {
  const res = await api.get("/students");
  return res.data;
}

/**
 * Get single student by ID
 * Includes memberships & relations (backend controlled)
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

export const getStudentsByLimit = async ({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) => {
  const res = await api.get("/students", {
    params: { page, limit },
  });
  console.log(res, "asdasd");

  return res.data;
};

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

export const getStudentDetails = async (id: string) => {
  const res = await api.get(`/students/${id}/details`);
  return res.data;
};
