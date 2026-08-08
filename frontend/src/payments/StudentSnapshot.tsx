type Props = {
  student: any;
  membership: any;
};

export default function StudentSnapshot({ student, membership }: Props) {
  if (!student || !membership) return null;

  const seat = membership.fixedSeat;

  return (
    <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-stone-700 mb-3">
        Student Snapshot
      </h2>

      <div className="space-y-2 text-sm text-stone-700">
        <div>
          <div className="font-medium">{student.name}</div>
          <div className="text-xs text-stone-500">{student.mobile}</div>
        </div>

        <div className="pt-2 border-t border-stone-200 space-y-1">
          <div className="flex justify-between">
            <span>Plan</span>
            <span className="font-medium">
              {membership.membershipPlan?.name}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Shift</span>
            <span className="font-medium">{membership.shift?.name}</span>
          </div>

          <div className="flex justify-between">
            <span>Valid Till</span>
            <span className="font-medium">
              {new Date(membership.endDate).toLocaleDateString("en-IN")}
            </span>
          </div>

          {seat && (
            <div className="flex justify-between">
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
