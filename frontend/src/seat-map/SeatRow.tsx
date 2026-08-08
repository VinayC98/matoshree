import Seat from "./Seat";

export default function SeatRow({
  row,
  onSeatClick,
}: {
  row: any;
  onSeatClick: (seat: any) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 text-xs text-stone-500 font-medium">
        R{row.rowNumber}
      </span>

      <div className="flex flex-wrap gap-2">
        {row.seats.map((seat: any) => (
          <Seat
            key={seat.seatId}
            seat={seat}
            onClick={() => onSeatClick(seat)}
          />
        ))}
      </div>
    </div>
  );
}
