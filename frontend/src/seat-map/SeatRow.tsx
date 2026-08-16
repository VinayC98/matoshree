import Seat from "./Seat";

type SeatItem = {
  seatId: string;
  seatNumber: number;
  status: string;
  student?: {
    id: string;
    name: string;
    mobile?: string;
  } | null;
  [key: string]: unknown;
};

type SeatRowData = {
  rowNumber: number;
  seats: SeatItem[];
};

type SeatRowProps = {
  row: SeatRowData;
  onSeatClick: (seat: SeatItem) => void;
};

export default function SeatRow({ row, onSeatClick }: SeatRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 text-xs font-medium text-stone-500">
        R{row.rowNumber}
      </span>

      <div className="flex flex-wrap gap-2">
        {row.seats.map((seat) => (
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
