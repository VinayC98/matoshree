import { useState } from "react";
import type { MouseEvent } from "react";

export type SeatPerson = {
  id?: string | null;
  studentId?: string | null;
  name?: string | null;
  studentName?: string | null;
  mobile?: string | null;
  shiftName?: string | null;
  shiftCode?: string | null;
  shifts?: string[];
  validTill?: string | Date | null;
  endDate?: string | Date | null;
  shift?: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
  } | null;
  student?: {
    id?: string | null;
    name?: string | null;
    mobile?: string | null;
    validTill?: string | Date | null;
    endDate?: string | Date | null;
    shiftName?: string | null;
  } | null;
  [key: string]: unknown;
};

export type SeatData = {
  seatId?: string | null;
  id?: string | null;
  seatNumber: number | string;
  status?: string | null;
  blockedByShift?: string | null;
  occupants?: SeatPerson[] | null;
  students?: SeatPerson[] | null;
  allocations?: Array<{
    studentId?: string | null;
    studentName?: string | null;
    validTill?: string | Date | null;
    endDate?: string | Date | null;
    student?: SeatPerson | null;
    shift?: {
      id?: string | null;
      name?: string | null;
      code?: string | null;
    } | null;
    shiftName?: string | null;
    shiftCode?: string | null;
    [key: string]: unknown;
  }> | null;
  student?: SeatPerson | null;
  shiftName?: string | null;
  labName?: string | null;
  occupantCount?: number;
  [key: string]: unknown;
};

type Props = {
  seat: SeatData;
  onClick: () => void;
};

/* =========================================================
   PEOPLE
========================================================= */

function getSeatPeople(seat: SeatData): SeatPerson[] {
  if (Array.isArray(seat.occupants)) {
    return seat.occupants;
  }

  if (Array.isArray(seat.students)) {
    return seat.students;
  }

  if (Array.isArray(seat.allocations)) {
    return seat.allocations
      .map((allocation): SeatPerson | null => {
        if (allocation.student) {
          return {
            ...allocation.student,
            id: allocation.student.id ?? allocation.studentId ?? undefined,
            studentId:
              allocation.studentId ?? allocation.student.id ?? undefined,
            name:
              allocation.student.name ?? allocation.studentName ?? "Unknown",
            studentName:
              allocation.student.name ?? allocation.studentName ?? "Unknown",
            shiftName:
              allocation.shift?.name ??
              allocation.shiftName ??
              allocation.shift?.code ??
              undefined,
            shiftCode:
              allocation.shift?.code ?? allocation.shiftCode ?? undefined,
            validTill:
              allocation.validTill ??
              allocation.endDate ??
              allocation.student.validTill ??
              allocation.student.endDate ??
              undefined,
          };
        }

        return {
          id: allocation.studentId ?? undefined,
          studentId: allocation.studentId ?? undefined,
          name: allocation.studentName ?? "Unknown",
          studentName: allocation.studentName ?? "Unknown",
          shiftName:
            allocation.shiftName ??
            allocation.shift?.name ??
            allocation.shiftCode ??
            allocation.shift?.code ??
            undefined,
          shiftCode:
            allocation.shiftCode ?? allocation.shift?.code ?? undefined,
          validTill: allocation.validTill ?? allocation.endDate ?? undefined,
        };
      })
      .filter((person): person is SeatPerson => person !== null);
  }

  if (seat.student) {
    return [
      {
        ...seat.student,
        shiftName: seat.shiftName ?? seat.student.shiftName ?? undefined,
      },
    ];
  }

  return [];
}

/* =========================================================
   SEAT
========================================================= */

export default function Seat({ seat, onClick }: Props) {
  const [hover, setHover] = useState(false);

  const [mousePosition, setMousePosition] = useState({
    x: 0,
    y: 0,
  });

  const people = getSeatPeople(seat);

  const status = String(seat.status ?? "").toUpperCase();

  const isFixed = status === "FIXED";
  const isOccupied = status === "OCCUPIED";

  let background = "bg-emerald-600";

  if (isOccupied) {
    background = "bg-amber-600";
  }

  if (isFixed) {
    background = "bg-stone-500";
  }

  const handleMouseMove = (event: MouseEvent<HTMLButtonElement>) => {
    setMousePosition({
      x: event.clientX + 12,
      y: event.clientY + 12,
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={isFixed}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={handleMouseMove}
        className={[
          "relative flex h-9 w-9 shrink-0 items-center justify-center",
          "rounded-md",
          "text-[10px] font-medium text-white",
          "transition-all duration-150",
          background,
          isFixed
            ? "cursor-not-allowed"
            : "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm",
        ].join(" ")}
      >
        {seat.seatNumber}

        {/* FIXED BADGE */}

        {isFixed && (
          <span
            className="
              absolute
              -right-1
              -top-1
              rounded
              bg-stone-800
              px-1
              text-[6px]
              font-semibold
              leading-[11px]
              text-white
            "
          >
            F
          </span>
        )}

        {/* OCCUPANT COUNT */}

        {people.length > 1 && (
          <span
            className="
              absolute
              -bottom-1
              -right-1
              min-w-[13px]
              rounded-full
              border
              border-white
              bg-stone-800
              px-1
              text-[6px]
              font-semibold
              leading-[11px]
              text-white
            "
          >
            {people.length}
          </span>
        )}
      </button>

      {hover && (
        <SeatTooltip
          seat={seat}
          people={people}
          x={mousePosition.x}
          y={mousePosition.y}
        />
      )}
    </>
  );
}

/* =========================================================
   TOOLTIP
========================================================= */

function SeatTooltip({
  seat,
  people,
  x,
  y,
}: {
  seat: SeatData;
  people: SeatPerson[];
  x: number;
  y: number;
}) {
  return (
    <div
      className="
        pointer-events-none
        fixed
        z-[9999]
        w-[220px]
        rounded-xl
        border
        border-stone-200
        bg-white
        p-3
        shadow-xl
      "
      style={{
        left: x,
        top: y,
      }}
    >
      {/* HEADER */}

      <div className="border-b border-stone-100 pb-2">
        <div className="text-xs font-medium text-stone-800">
          Seat {seat.seatNumber}
        </div>

        <div className="mt-0.5 text-[10px] text-stone-500">
          {String(seat.status ?? "").toUpperCase() === "FIXED"
            ? "Fixed Seat"
            : String(seat.status ?? "").toUpperCase() === "OCCUPIED"
              ? "Occupied"
              : "Available"}
        </div>
      </div>

      {/* AVAILABLE */}

      {String(seat.status ?? "").toUpperCase() === "FREE" &&
        people.length === 0 && (
          <div className="pt-2 text-[10px] text-emerald-700">
            Click to assign this seat.
          </div>
        )}

      {/* PEOPLE */}

      {people.length > 0 && (
        <div className="space-y-1.5 pt-2">
          {people.map((person, index) => {
            const shifts = Array.isArray(person.shifts)
              ? person.shifts
              : person.shiftName
                ? [person.shiftName]
                : person.shift?.name
                  ? [person.shift.name]
                  : person.shift?.code
                    ? [person.shift.code]
                    : [];

            const uniqueShifts = Array.from(
              new Set(
                shifts
                  .filter(
                    (shift): shift is string =>
                      typeof shift === "string" && shift.length > 0,
                  )
                  .map((shift) => String(shift)),
              ),
            );

            const personName =
              person.studentName ??
              person.name ??
              person.student?.name ??
              "Unknown";

            const validTill =
              person.validTill ??
              person.endDate ??
              person.student?.validTill ??
              person.student?.endDate;

            const personKey = person.studentId ?? person.id ?? personName;

            return (
              <div
                key={`${String(personKey)}-${index}`}
                className="rounded-lg bg-stone-50 px-2 py-2"
              >
                <div className="text-xs font-medium text-stone-800">
                  {personName}
                </div>

                {uniqueShifts.length > 0 && (
                  <div className="mt-0.5 text-[10px] text-stone-500">
                    {uniqueShifts.join(" · ")}
                  </div>
                )}

                {validTill && (
                  <div className="mt-0.5 text-[9px] text-stone-400">
                    Valid till {new Date(validTill).toLocaleDateString("en-IN")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BLOCK */}

      {seat.blockedByShift && (
        <div className="mt-2 border-t border-stone-100 pt-2 text-[10px] text-stone-500">
          Blocked by{" "}
          <strong className="font-medium text-stone-700">
            {seat.blockedByShift}
          </strong>
        </div>
      )}
    </div>
  );
}
