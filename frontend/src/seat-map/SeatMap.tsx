import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getSeatMap, swapDailySeat } from "../api/seatMap.api";
import { getShifts } from "../api/memberships.api";
import LabSection from "./LabSection";
import AssignSeatModal from "./AssignSeatModal";
import SeatLegend from "./components/SeatLegends";
import { toast } from "react-toastify";

export default function SeatMap() {
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [shiftId, setShiftId] = useState("");
  const [selectedSeat, setSelectedSeat] = useState<any>(null);

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  const selectedShift = useMemo(
    () => shiftsQuery.data?.find((s: any) => s.id === shiftId),
    [shiftsQuery.data, shiftId],
  );

  const seatMapQuery = useQuery({
    queryKey: ["seat-map", date, shiftId],
    queryFn: () => getSeatMap({ date, shiftId }),
    enabled: !!shiftId,
  });

  const handleSeatClick = (seat: any) => {
    // FIXED seat → show info modal only
    if (seat.status === "FIXED") {
      setSelectedSeat({
        ...seat,
        viewingShift: selectedShift?.name,
        viewingDate: date,
      });
      return;
    }

    // OCCUPIED seat → just view details (NO SWAP)
    if (seat.status === "OCCUPIED") {
      setSelectedSeat({
        ...seat,
        viewingShift: selectedShift?.name,
        viewingDate: date,
      });
      return;
    }

    // FREE seat → assign modal
    setSelectedSeat({
      ...seat,
      viewingShift: selectedShift?.name,
      viewingDate: date,
    });
  };

  return (
    <div className="px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Seat Map</h1>
          <p className="text-sm text-stone-500">
            Assign & manage seats (admin only)
          </p>
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
              disabled={shiftsQuery.isLoading}
            >
              <option value="">Select shift</option>
              {shiftsQuery.data?.map((shift: any) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SeatLegend />

        {/* {isSwapMode && (
          <div className="bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm">
            Swap Mode Active — Click another occupied seat to complete swap
            <button
              onClick={() => {
                setSwapSeatA(null);
                setIsSwapMode(false);
              }}
              className="ml-4 text-xs underline"
            >
              Cancel
            </button>
          </div>
        )} */}

        {/* MAP AREA */}
        <div className="bg-stone-100/60 border border-stone-200 rounded-2xl p-4">
          {seatMapQuery.isLoading && (
            <p className="text-sm text-stone-500 italic">Loading seat map…</p>
          )}

          {seatMapQuery.data?.length === 0 && (
            <p className="text-sm text-stone-500 italic">
              No seats available for this shift.
            </p>
          )}

          {!shiftId && (
            <div className="text-sm text-stone-500 italic">
              Select a shift to assign the seat.
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
                <LabSection
                  key={lab.labId}
                  lab={lab}
                  onSeatClick={handleSeatClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* MODAL */}
        {selectedSeat && (
          <AssignSeatModal
            seat={selectedSeat}
            shiftId={shiftId}
            date={date}
            onClose={() => setSelectedSeat(null)}
            onSuccess={() => {
              setSelectedSeat(null);
              seatMapQuery.refetch();
            }}
          />
        )}
      </div>
    </div>
  );
}
