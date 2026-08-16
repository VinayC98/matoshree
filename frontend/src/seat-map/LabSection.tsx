import Seat, { type SeatData, type SeatPerson } from "./Seat";

type LabRow = {
  rowNumber: number | string;
  seats?: SeatData[] | null;
};

export type LabSectionData = {
  labId: string;
  labName?: string | null;
  rows?: LabRow[] | null;
};

type LabSectionProps = {
  lab: LabSectionData;
  onSeatClick: (seat: SeatData) => void;
};

type NormalizedPerson = SeatPerson & {
  studentId: string;
  studentName: string;
  name: string;
  validTill?: string | Date | null;
  shifts: string[];
};

type NormalizedSeat = SeatData & {
  labName: string;
  occupants: NormalizedPerson[];
  student?: SeatPerson;
  occupantCount: number;
};

/* =========================================================
   NORMALIZE OCCUPANTS
========================================================= */

function normalizeOccupants(seat: SeatData): NormalizedPerson[] {
  const rawOccupants = Array.isArray(seat.occupants) ? seat.occupants : [];

  const students = new Map<string, NormalizedPerson>();

  rawOccupants.forEach((occupant, index) => {
    const studentId =
      occupant.studentId ??
      occupant.student?.id ??
      occupant.id ??
      occupant.studentName ??
      occupant.student?.name ??
      occupant.name ??
      `unknown-${index}`;

    const key = String(studentId);

    const studentName =
      occupant.studentName ??
      occupant.student?.name ??
      occupant.name ??
      "Unknown";

    const shiftName =
      occupant.shiftName ??
      occupant.shift?.name ??
      occupant.shiftCode ??
      occupant.shift?.code ??
      "";

    const validTill =
      occupant.validTill ??
      occupant.endDate ??
      occupant.student?.validTill ??
      occupant.student?.endDate;

    const existing = students.get(key);

    if (!existing) {
      students.set(key, {
        ...occupant,
        studentId: key,
        id: occupant.id ?? key,
        name: studentName,
        studentName,
        validTill,
        shifts: shiftName ? [shiftName] : [],
      });

      return;
    }

    if (
      shiftName &&
      !existing.shifts.some(
        (existingShift) =>
          existingShift.toLowerCase() === shiftName.toLowerCase(),
      )
    ) {
      existing.shifts.push(shiftName);
    }

    if (!existing.validTill && validTill) {
      existing.validTill = validTill;
    }
  });

  return Array.from(students.values());
}

/* =========================================================
   NORMALIZE SEAT
========================================================= */

function normalizeSeat(seat: SeatData, labName: string): NormalizedSeat {
  const occupants = normalizeOccupants(seat);

  const firstOccupant = occupants[0];

  return {
    ...seat,

    labName,

    occupants,

    student:
      seat.student ??
      (occupants.length === 1 && firstOccupant
        ? {
            id: firstOccupant.studentId,
            name: firstOccupant.studentName,
            validTill: firstOccupant.validTill,
          }
        : undefined),

    occupantCount: occupants.length,
  };
}

/* =========================================================
   LAB SECTION
========================================================= */

export default function LabSection({ lab, onSeatClick }: LabSectionProps) {
  const labName = lab.labName ?? "Lab";

  const rows = Array.isArray(lab.rows) ? lab.rows : [];

  const totalSeats = rows.reduce(
    (total, row) => total + (Array.isArray(row.seats) ? row.seats.length : 0),
    0,
  );

  const fixedSeats = rows.reduce(
    (total, row) =>
      total +
      (Array.isArray(row.seats)
        ? row.seats.filter(
            (seat) => String(seat.status ?? "").toUpperCase() === "FIXED",
          ).length
        : 0),
    0,
  );

  const occupiedSeats = rows.reduce(
    (total, row) =>
      total +
      (Array.isArray(row.seats)
        ? row.seats.filter(
            (seat) => String(seat.status ?? "").toUpperCase() === "OCCUPIED",
          ).length
        : 0),
    0,
  );

  const availableSeats = Math.max(totalSeats - fixedSeats - occupiedSeats, 0);

  return (
    <section className="overflow-visible rounded-xl border border-stone-200 bg-white shadow-sm">
      {/* =====================================================
          LAB HEADER
      ===================================================== */}

      <div className="border-b border-stone-200 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">{labName}</h2>

            <div className="mt-1 h-0.5 w-10 rounded-full bg-amber-600" />
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5 text-[9px]">
            <span className="text-stone-500">{totalSeats} seats</span>

            {availableSeats > 0 && (
              <span className="text-emerald-600">
                {availableSeats} available
              </span>
            )}

            {occupiedSeats > 0 && (
              <span className="text-amber-600">{occupiedSeats} occupied</span>
            )}

            {fixedSeats > 0 && (
              <span className="text-stone-500">{fixedSeats} fixed</span>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          SEAT GRID
      ===================================================== */}

      <div className="px-4 py-3 sm:px-5 sm:py-4">
        <div className="space-y-1">
          {rows.map((row) => {
            const seats = Array.isArray(row.seats) ? row.seats : [];

            return (
              <div
                key={row.rowNumber}
                className="flex min-w-0 items-center gap-3 py-1.5"
              >
                {/* ROW LABEL */}

                <div className="w-7 shrink-0 text-[10px] font-medium text-stone-400">
                  R{row.rowNumber}
                </div>

                {/* ROW DIVIDER + SEATS */}

                <div className="min-w-0 flex-1">
                  <div className="mb-2 h-px w-full bg-stone-100" />

                  <div className="flex flex-wrap gap-2">
                    {seats.map((seat) => {
                      const normalizedSeat = normalizeSeat(seat, labName);

                      return (
                        <Seat
                          key={
                            seat.seatId ??
                            seat.id ??
                            `${lab.labId}-${row.rowNumber}-${seat.seatNumber}`
                          }
                          seat={normalizedSeat}
                          onClick={() => onSeatClick(normalizedSeat)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
