type Student = {
  name: string;
  mobile: string;
};

type FixedSeat = {
  seatNumber: number;
  lab: {
    name: string;
  };
};

type Membership = {
  endDate: string;
  membershipPlan?: {
    name: string;
  } | null;
  shift?: {
    name: string;
  } | null;
  fixedSeat?: FixedSeat | null;
};

type Props = {
  student: Student | null | undefined;
  membership: Membership | null | undefined;
};

export default function StudentSnapshot({ student, membership }: Props) {
  if (!student || !membership) return null;

  const seat = membership.fixedSeat;

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-100/80 p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-stone-700">
        Student Snapshot
      </h2>

      <div className="space-y-2 text-sm text-stone-700">
        <div>
          <div className="font-medium">{student.name}</div>

          <div className="text-xs text-stone-500">{student.mobile}</div>
        </div>

        <div className="space-y-1 border-t border-stone-200 pt-2">
          <div className="flex justify-between gap-4">
            <span>Plan</span>

            <span className="font-medium">
              {membership.membershipPlan?.name ?? "—"}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span>Shift</span>

            <span className="font-medium">{membership.shift?.name ?? "—"}</span>
          </div>

          <div className="flex justify-between gap-4">
            <span>Valid Till</span>

            <span className="font-medium">
              {new Date(membership.endDate).toLocaleDateString("en-IN")}
            </span>
          </div>

          {seat && (
            <div className="flex justify-between gap-4">
              <span>Seat</span>

              <span className="font-medium">
                {seat.lab.name} – Seat {seat.seatNumber}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
