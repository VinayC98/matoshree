import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getStudents } from "../api/students.api";
import { assignSeat } from "../api/seatMap.api";
import { toast } from "react-toastify";

type Props = {
  seat: any;
  shiftId: string;
  date: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AssignSeatModal({
  seat,
  shiftId,
  date,
  onClose,
  onSuccess,
}: Props) {
  const [studentId, setStudentId] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  const isFixedSeat = seat.status === "FIXED";
  const isOccupiedSeat = seat.status === "OCCUPIED";

  /* ===============================
     ASSIGN MUTATION (UNCHANGED)
  =============================== */

  const assignMutation = useMutation({
    mutationFn: assignSeat,
    onSuccess: () => {
      toast.success("Seat assigned successfully!");
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Something went wrong!");
    },
  });

  /* ===============================
     SUBMIT HANDLER
  =============================== */

  const handleSubmit = () => {
    if (!studentId) return;

    // ❌ FIXED SEATS CANNOT BE ASSIGNED HERE
    if (isFixedSeat) return;

    // ✅ NORMAL ASSIGN
    assignMutation.mutate({
      studentId,
      seatId: seat.seatId,
      shiftId,
      date,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[420px] space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold">
            {isFixedSeat ? "Fixed Seat" : "Assign Seat"} – {seat.seatNumber}
          </h2>
          <p className="text-sm text-gray-500">Lab: {seat.labName}</p>
        </div>

        {/* FIXED INFO BLOCK */}
        {isFixedSeat && seat.student && (
          <div className="border rounded p-3 bg-gray-50 text-sm space-y-1">
            <p className="font-medium text-gray-800 flex items-center gap-1">
              🔒 Fixed Seat
            </p>
            <p>
              Owned by <strong>{seat.student.name}</strong>
            </p>
            {seat.student.validTill && (
              <p className="text-xs text-gray-500">
                Valid till {seat.student.validTill.split("T")[0]}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Fixed seats must be changed from membership settings.
            </p>
          </div>
        )}

        {/* STUDENT SELECT (ONLY FOR ASSIGN) */}
        {!isOccupiedSeat && !isFixedSeat && (
          <select
            className="border p-2 rounded w-full"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={studentsQuery.isLoading}
          >
            <option value="">Select Student</option>
            {studentsQuery.data?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.mobile})
              </option>
            ))}
          </select>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>

          {!isFixedSeat && seat.status === "FREE" && (
            <button
              onClick={handleSubmit}
              disabled={!isOccupiedSeat && !studentId}
              className={`px-4 py-2 text-white rounded disabled:opacity-50 ${
                isOccupiedSeat ? "bg-orange-600" : "bg-blue-600"
              }`}
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
