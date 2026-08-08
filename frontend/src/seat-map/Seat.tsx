import { useState } from "react";

export default function Seat({
  seat,
  onClick,
}: {
  seat: any;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  const isFixed = seat.status === "FIXED";

  const bg =
    seat.status === "FREE"
      ? "bg-emerald-600"
      : seat.status === "OCCUPIED"
        ? "bg-amber-600"
        : "bg-stone-500";

  return (
    <>
      <button
        onClick={onClick}
        disabled={isFixed}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={[
          "relative w-10 h-10 rounded-lg text-xs font-medium text-white",
          "transition-all duration-200",
          "hover:scale-105 hover:shadow-md",
          isFixed ? "cursor-not-allowed opacity-80" : "",
          bg,
        ].join(" ")}
      >
        {seat.seatNumber}

        {isFixed && (
          <span className="absolute -top-1 -right-1 bg-stone-800 text-white text-[9px] px-1.5 py-0.5 rounded">
            FIXED
          </span>
        )}
      </button>

      {hover && (
        <div
          className="fixed z-[9999] bg-white border border-stone-200 rounded-lg shadow-lg p-3 text-xs w-56"
          style={{
            left: seat.__hoverX,
            top: seat.__hoverY,
            pointerEvents: "none",
          }}
        >
          <p className="font-semibold text-stone-800">
            Seat {seat.seatNumber} – {seat.labName}
          </p>

          <p className="text-stone-600 mt-1">
            Status: <strong>{seat.status}</strong>
          </p>

          {seat.student && (
            <>
              <p className="text-stone-600 mt-1">
                Student: <strong>{seat.student.name}</strong>
              </p>

              {seat.blockedByShift && (
                <p className="text-stone-600">
                  Blocked by: {seat.blockedByShift}
                </p>
              )}

              {seat.student.validTill && (
                <p className="text-stone-500 mt-1">
                  Valid till:{" "}
                  {new Date(seat.student.validTill).toLocaleDateString()}
                </p>
              )}
            </>
          )}

          {!seat.student && (
            <p className="text-stone-500 mt-1 italic">
              Click to assign this seat
            </p>
          )}
        </div>
      )}
    </>
  );
}
