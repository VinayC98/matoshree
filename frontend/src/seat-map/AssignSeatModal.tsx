import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { searchStudentOptions, getStudentById } from "../api/students.api";

import { assignSeat } from "../api/seatMap.api";
import type { SeatData } from "./Seat";

type StudentOption = {
  id: string;
  name: string;
  mobile: string;
  [key: string]: unknown;
};

type AssignSeatData = SeatData & {
  viewingShift?: string | null;
  viewingShiftCode?: string | null;
  viewingDate?: string | null;
};

type Props = {
  seat: AssignSeatData;
  shiftId: string;
  date: string;
  preselectedStudentId?: string;
  onClose: () => void;
  onSuccess: () => void;
};

type ApiErrorResponse = {
  message?: string | string[];
};

type ApiError = {
  response?: {
    data?: ApiErrorResponse;
  };
  message?: string;
};

function isApiError(error: unknown): error is ApiError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return true;
}

function getErrorMessage(error: unknown): string | string[] | undefined {
  if (!isApiError(error)) {
    return undefined;
  }

  return error.response?.data?.message;
}

function normalizeStudent(value: unknown): StudentOption | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const id = record.id;
  const name = record.name;
  const mobile = record.mobile;

  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof mobile !== "string"
  ) {
    return null;
  }

  return {
    ...record,
    id,
    name,
    mobile,
  };
}

export default function AssignSeatModal({
  seat,
  shiftId,
  date,
  preselectedStudentId = "",
  onClose,
  onSuccess,
}: Props) {
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState(preselectedStudentId);

  /*
   * =========================================================
   * DEBOUNCED SEARCH
   * =========================================================
   */

  const [debouncedSearch, setDebouncedSearch] = useState("");

  /*
   * =========================================================
   * SEAT STATE
   * =========================================================
   */

  const seatStatus = String(seat.status ?? "").toUpperCase();

  const isFixedSeat = seatStatus === "FIXED";

  const isOccupiedSeat = seatStatus === "OCCUPIED";

  const isFreeSeat = seatStatus === "FREE";

  /*
   * =========================================================
   * SEARCH DEBOUNCE
   * =========================================================
   */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  /*
   * =========================================================
   * STUDENT SEARCH
   * =========================================================
   */

  const studentsQuery = useQuery<StudentOption[]>({
    queryKey: ["student-options", debouncedSearch],

    queryFn: async () => {
      const result = await searchStudentOptions({
        search: debouncedSearch,
        limit: 10,
        hasActiveMembership: true,
      });

      if (!Array.isArray(result)) {
        return [];
      }

      return result
        .map(normalizeStudent)
        .filter((student): student is StudentOption => student !== null);
    },

    /*
     * Do not call the API until the user
     * has entered at least 2 characters.
     */
    enabled: debouncedSearch.length >= 2,

    staleTime: 30_000,
  });

  /*
   * =========================================================
   * PRESELECTED STUDENT
   * =========================================================
   */

  const selectedStudentQuery = useQuery<StudentOption | null>({
    queryKey: ["student", preselectedStudentId],

    queryFn: async () => {
      const result = await getStudentById(preselectedStudentId);

      return normalizeStudent(result);
    },

    enabled: Boolean(preselectedStudentId),
  });

  /*
   * =========================================================
   * PRESELECTED STUDENT DISPLAY
   * =========================================================
   *
   * We intentionally do NOT call setState() here.
   *
   * The selected student's name is derived directly from
   * query data, which avoids the React set-state-in-effect
   * warning and prevents unnecessary cascading renders.
   */

  const selectedStudent = selectedStudentQuery.data;

  const displayedSearch = search || selectedStudent?.name || "";

  /*
   * =========================================================
   * ASSIGN MUTATION
   * =========================================================
   */

  const assignMutation = useMutation({
    mutationFn: assignSeat,

    onSuccess: () => {
      toast.success("Seat assigned successfully.");

      onSuccess();
      onClose();
    },

    onError: (error: unknown) => {
      const message = getErrorMessage(error);

      if (Array.isArray(message)) {
        toast.error(message.join(", "));
        return;
      }

      toast.error(
        message ||
          (isApiError(error) ? error.message : undefined) ||
          "Failed to assign seat.",
      );
    },
  });

  /*
   * =========================================================
   * SELECT STUDENT
   * =========================================================
   */

  const handleStudentChange = (value: string) => {
    setStudentId(value);
  };

  /*
   * =========================================================
   * ASSIGN
   * =========================================================
   */

  const handleSubmit = () => {
    if (isFixedSeat) {
      return;
    }

    if (!isFreeSeat) {
      toast.info("This seat is not available.");
      return;
    }

    if (!studentId) {
      toast.error("Please select a student.");
      return;
    }

    if (!seat.seatId) {
      toast.error("Seat information is invalid. Please refresh and try again.");
      return;
    }

    if (!shiftId) {
      toast.error("Shift information is missing. Please select a shift.");
      return;
    }

    if (!date) {
      toast.error("Date information is missing.");
      return;
    }

    assignMutation.mutate({
      studentId,
      seatId: seat.seatId,
      shiftId,
      date,
    });
  };

  /*
   * =========================================================
   * DISPLAY DATE
   * =========================================================
   */

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

  /*
   * =========================================================
   * STUDENT OPTIONS
   * =========================================================
   */

  const students = studentsQuery.data ?? [];

  /*
   * If the selected student isn't in
   * the current search result, keep them
   * visible in the select.
   */

  const hasSelectedStudentInResults = students.some(
    (student) => student.id === studentId,
  );

  const displayStudents =
    selectedStudent && studentId && !hasSelectedStudentInResults
      ? [selectedStudent, ...students]
      : students;

  const displayedSelectedStudent = displayStudents.find(
    (student) => student.id === studentId,
  );

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        {/* ============================
            HEADER
        ============================ */}

        <div className="border-b border-stone-200 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-stone-800">
                  {isFixedSeat
                    ? "Fixed Seat"
                    : isOccupiedSeat
                      ? "Occupied Seat"
                      : "Assign Seat"}
                </h2>

                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[9px] font-medium",
                    isFixedSeat
                      ? "bg-stone-200 text-stone-700"
                      : isOccupiedSeat
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700",
                  ].join(" ")}
                >
                  {isFixedSeat
                    ? "FIXED"
                    : isOccupiedSeat
                      ? "OCCUPIED"
                      : "AVAILABLE"}
                </span>
              </div>

              <p className="mt-1 text-xs text-stone-500">
                {seat.labName ?? "Lab"} · Seat {seat.seatNumber}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-lg leading-none text-stone-400 hover:text-stone-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* ============================
            BODY
        ============================ */}

        <div className="space-y-4 p-5">
          {/* DATE + SHIFT */}

          <div className="grid grid-cols-2 gap-3">
            <InfoBox label="DATE" value={formattedDate} />

            <InfoBox
              label="SHIFT"
              value={seat.viewingShift || "Selected shift"}
            />
          </div>

          {/* ============================
              FIXED SEAT
          ============================ */}

          {isFixedSeat && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm font-medium text-stone-800">
                Membership-locked seat
              </div>

              {seat.student && (
                <div className="mt-2 space-y-1 text-xs text-stone-600">
                  <div>
                    Owner:{" "}
                    <strong className="text-stone-800">
                      {seat.student.name ??
                        seat.student.studentName ??
                        "Unknown"}
                    </strong>
                  </div>

                  {seat.student.validTill && (
                    <div>
                      Valid till:{" "}
                      {new Date(seat.student.validTill).toLocaleDateString(
                        "en-IN",
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 text-[10px] text-stone-500">
                Fixed seats can only be changed through membership settings.
              </p>
            </div>
          )}

          {/* ============================
              OCCUPIED SEAT
          ============================ */}

          {isOccupiedSeat && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-medium text-amber-800">
                Seat currently occupied
              </div>

              {seat.student && (
                <div className="mt-2 text-xs text-amber-700">
                  Student:{" "}
                  <strong>
                    {seat.student.name ?? seat.student.studentName ?? "Unknown"}
                  </strong>
                </div>
              )}

              {seat.blockedByShift && (
                <div className="mt-1 text-xs text-amber-700">
                  Blocked by: <strong>{seat.blockedByShift}</strong>
                </div>
              )}
            </div>
          )}

          {/* ============================
              FREE SEAT
          ============================ */}

          {isFreeSeat && (
            <div>
              <div className="mb-2">
                <label className="text-sm font-medium text-stone-700">
                  Select student
                </label>

                <p className="mt-0.5 text-xs text-stone-500">
                  Search by student name or mobile number.
                </p>
              </div>

              {/* SEARCH INPUT */}

              <input
                type="text"
                value={displayedSearch}
                onChange={(event) => {
                  const nextSearch = event.target.value;

                  setSearch(nextSearch);

                  /*
                   * If the user changes the
                   * search after selecting a
                   * student, clear the old
                   * selection.
                   */
                  if (studentId && nextSearch !== selectedStudent?.name) {
                    setStudentId("");
                  }
                }}
                placeholder="Search student..."
                autoFocus
                className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />

              {/* SEARCH STATUS */}

              {debouncedSearch.length === 1 && (
                <p className="mt-2 text-[10px] text-stone-400">
                  Enter at least 2 characters to search.
                </p>
              )}

              {studentsQuery.isFetching && debouncedSearch.length >= 2 && (
                <p className="mt-2 text-[10px] text-stone-500">
                  Searching students…
                </p>
              )}

              {/* STUDENT SELECT */}

              <select
                value={studentId}
                onChange={(event) => handleStudentChange(event.target.value)}
                disabled={
                  studentsQuery.isFetching || displayStudents.length === 0
                }
                className="mt-2 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-50 disabled:text-stone-400"
              >
                <option value="">
                  {studentsQuery.isFetching
                    ? "Searching..."
                    : displayStudents.length === 0
                      ? debouncedSearch.length < 2
                        ? "Search for a student"
                        : "No students found"
                      : "Select student"}
                </option>

                {displayStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.mobile})
                  </option>
                ))}
              </select>

              {/* SELECTED STUDENT */}

              {studentId && (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Student selected:{" "}
                  <strong>{displayedSelectedStudent?.name}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================
            FOOTER
        ============================ */}

        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-stone-300 bg-white px-4 text-sm text-stone-700 hover:bg-stone-100"
          >
            Close
          </button>

          {isFreeSeat && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!studentId || !seat.seatId || assignMutation.isPending}
              className="h-9 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assignMutation.isPending ? "Assigning…" : "Assign Seat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INFO BOX
========================================================= */

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5">
      <div className="text-[9px] font-medium text-stone-400">{label}</div>

      <div className="mt-1 text-xs font-medium text-stone-700">{value}</div>
    </div>
  );
}
