import Seat from "./Seat";

export default function LabSection({
  lab,
  onSeatClick,
}: {
  lab: any;
  onSeatClick: (seat: any) => void;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-stone-800">
          {lab.labName}
        </h2>
        <div className="h-0.5 w-10 bg-amber-600 mt-1 rounded" />
      </div>

      <div className="space-y-3">
        {lab.rows.map((row: any) => (
          <div key={row.rowNumber} className="flex items-center gap-3">
            <span className="w-7 text-xs text-stone-500 font-medium">
              R{row.rowNumber}
            </span>

            <div className="flex flex-wrap gap-2">
              {row.seats.map((seat: any) => (
                <div
                  key={seat.seatId}
                  onMouseMove={(e) => {
                    seat.__hoverX = e.clientX + 12;
                    seat.__hoverY = e.clientY + 12;
                  }}
                >
                  <Seat
                    seat={{
                      ...seat,
                      labName: lab.labName,
                    }}
                    onClick={() =>
                      onSeatClick({
                        ...seat,
                        labName: lab.labName,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
