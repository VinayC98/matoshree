import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getSeatMap } from "../api/seatMap.api";
import { getShifts } from "../api/memberships.api";

export default function SeatMapView() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [shiftId, setShiftId] = useState("");

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  const selectedShift = useMemo(
    () => shiftsQuery.data?.find((s: any) => s.id === shiftId),
    [shiftsQuery.data, shiftId],
  );

  const seatMapQuery = useQuery({
    queryKey: ["seat-map-view", date, shiftId],
    queryFn: () => getSeatMap({ date, shiftId }),
    enabled: !!shiftId,
  });

  return (
    <div className="px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Seat Map</h1>
          <p className="text-sm text-stone-500">View-only occupancy overview</p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap gap-4 bg-stone-100/80 border border-stone-200 rounded-xl p-4">
          <div className="flex flex-col text-sm">
            <label className="text-stone-600 mb-1">Date</label>
            <input
              type="date"
              className="h-9 rounded-md border border-stone-300 bg-white px-3"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col text-sm min-w-[220px]">
            <label className="text-stone-600 mb-1">Shift</label>
            <select
              className="h-9 rounded-md border border-stone-300 bg-white px-3"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value="">Select shift</option>
              {shiftsQuery.data?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LEGEND */}
        <div className="flex gap-6 text-sm">
          <LegendItem color="bg-emerald-600" label="Free" />
          <LegendItem color="bg-amber-600" label="Occupied" />
          <LegendItem color="bg-stone-500" label="Fixed Seat" />
        </div>

        {/* MAP AREA */}
        <div className="bg-stone-100/60 border border-stone-200 rounded-2xl p-4">
          {!shiftId && (
            <div className="text-sm text-stone-500 italic">
              Select a shift to view the seat map.
            </div>
          )}

          {shiftId && (
            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-6
                h-[70vh]
                overflow-auto
                pr-2
              "
            >
              {seatMapQuery.data?.map((lab: any) => (
                <div
                  key={lab.labId}
                  className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm"
                >
                  {/* LAB HEADER */}
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-stone-800">
                      {lab.labName}
                    </h2>
                    <div className="h-0.5 w-10 bg-amber-600 mt-1 rounded" />
                  </div>

                  {/* SEAT GRID */}
                  <div className="space-y-3">
                    {lab.rows.map((row: any) => (
                      <div
                        key={row.rowNumber}
                        className="flex items-center gap-3"
                      >
                        {/* Row label */}
                        <div className="w-7 text-xs text-stone-500 font-medium">
                          R{row.rowNumber}
                        </div>

                        {/* Seats */}
                        <div className="flex flex-wrap gap-2">
                          {row.seats.map((seat: any) => {
                            let bg = "bg-emerald-600";
                            let ring = "";
                            let badge = null;

                            if (seat.status === "FIXED") {
                              bg = "bg-stone-500";
                              ring = "ring-2 ring-stone-400";
                              badge = "FIXED";
                            } else if (seat.status === "OCCUPIED") {
                              bg = "bg-amber-600";
                            }

                            const tooltip = seat.student
                              ? seat.status === "FIXED"
                                ? `Seat ${seat.seatNumber}
Fixed seat
Owner: ${seat.student.name}
Valid till: ${seat.student.validTill?.split("T")[0]}`
                                : `Seat ${seat.seatNumber}
Occupied by: ${seat.student.name}
Blocked by shift: ${seat.blockedByShift}
Viewing shift: ${selectedShift?.name}
Date: ${date}`
                              : `Seat ${seat.seatNumber}
FREE
Shift: ${selectedShift?.name}
Date: ${date}`;

                            return (
                              <div
                                key={seat.seatId}
                                title={tooltip}
                                className="relative"
                              >
                                <div
                                  className={[
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    "text-xs font-medium text-white",
                                    "transition-all duration-200",
                                    "hover:scale-105 hover:shadow-md",
                                    bg,
                                    ring,
                                  ].join(" ")}
                                >
                                  {seat.seatNumber}
                                </div>

                                {badge && (
                                  <span className="absolute -top-1 -right-1 text-[10px] bg-stone-800 text-white px-1.5 py-0.5 rounded">
                                    {badge}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =======================
   LEGEND ITEM
======================= */

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded ${color}`} />
      <span className="text-stone-700">{label}</span>
    </div>
  );
}
