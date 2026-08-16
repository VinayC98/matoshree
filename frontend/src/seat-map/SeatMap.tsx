import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getSeatMap } from "../api/seatMap.api";
import { getShifts } from "../api/memberships.api";

import LabSection from "./LabSection";
import AssignSeatModal from "./AssignSeatModal";
import SeatLegend from "./components/SeatLegends";

const getLocalDate = (): string => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/*
 * =========================================================
 * API TYPES
 * =========================================================
 *
 * These types intentionally describe the response shape used
 * by this component without changing the existing API flow.
 */

type Shift = {
  id: string;
  name?: string | null;
  code?: string | null;
};

type StudentReference = {
  id?: string | null;
  name?: string | null;
  mobile?: string | null;
};

type SeatOccupant = {
  studentId?: string | null;
  studentName?: string | null;
  name?: string | null;
  mobile?: string | null;
  shiftId?: string | null;
  shiftName?: string | null;
  shiftCode?: string | null;
  student?: StudentReference | null;
  shift?: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
  } | null;
};

type Seat = {
  seatId?: string | null;
  id?: string | null;
  seatNumber: number | string;
  status?: string | null;
  isFixed?: boolean | null;
  isFixedLocked?: boolean | null;
  blockedByShift?: string | null;
  blockedByShiftName?: string | null;
  occupants?: SeatOccupant[] | null;
};

type LabRow = {
  rowNumber: number | string;
  seats?: Seat[] | null;
};

type Lab = {
  labId: string;
  labName: string;
  rows?: LabRow[] | null;
};

type SelectedSeat = Seat & {
  viewingShift: string;
  viewingShiftCode: string;
  viewingDate: string;
};

/*
 * =========================================================
 * SEAT MAP
 * =========================================================
 */

export default function SeatMap() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [date, setDate] = useState(getLocalDate);
  const [shiftId, setShiftId] = useState("");
  const [selectedSeat, setSelectedSeat] = useState<SelectedSeat | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "FREE" | "OCCUPIED" | "FIXED"
  >("ALL");

  const preselectedStudentId = searchParams.get("studentId") ?? "";

  /*
   * =========================================================
   * SHIFTS
   * =========================================================
   */

  const shiftsQuery = useQuery<Shift[]>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const result = await getShifts();

      if (!Array.isArray(result)) {
        return [];
      }

      return result as Shift[];
    },
  });

  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data]);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === shiftId),
    [shifts, shiftId],
  );

  /*
   * =========================================================
   * SEAT MAP
   * =========================================================
   */

  const seatMapQuery = useQuery<Lab[]>({
    queryKey: ["seat-map", date, shiftId],
    queryFn: async () => {
      const result = await getSeatMap({
        date,
        shiftId,
      });

      if (!Array.isArray(result)) {
        return [];
      }

      return result as Lab[];
    },
    enabled: Boolean(shiftId),
  });

  /*
   * Keep the array reference stable.
   *
   * This fixes the react-hooks/exhaustive-deps warning caused
   * by:
   *
   * Array.isArray(data) ? data : []
   *
   * because [] creates a new array on every render.
   */

  const labs = useMemo<Lab[]>(
    () => (Array.isArray(seatMapQuery.data) ? seatMapQuery.data : []),
    [seatMapQuery.data],
  );

  /*
   * =========================================================
   * FILTERED LAB DATA
   * =========================================================
   */

  const filteredLabs = useMemo<Lab[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return labs
      .map((lab) => {
        const filteredRows = (lab.rows ?? [])
          .map((row) => {
            const filteredSeats = (row.seats ?? []).filter((seat) => {
              const normalizedStatus = String(seat.status ?? "").toUpperCase();

              const matchesStatus =
                statusFilter === "ALL" || normalizedStatus === statusFilter;

              if (!matchesStatus) {
                return false;
              }

              if (!normalizedSearch) {
                return true;
              }

              const occupants = Array.isArray(seat.occupants)
                ? seat.occupants
                : [];

              const studentMatches = occupants.some((person) => {
                const name =
                  person.studentName ??
                  person.student?.name ??
                  person.name ??
                  "";

                return String(name).toLowerCase().includes(normalizedSearch);
              });

              const seatMatches = String(seat.seatNumber ?? "")
                .toLowerCase()
                .includes(normalizedSearch);

              return seatMatches || studentMatches;
            });

            return {
              ...row,
              seats: filteredSeats,
            };
          })
          .filter((row) => row.seats.length > 0);

        return {
          ...lab,
          rows: filteredRows,
        };
      })
      .filter((lab) => lab.rows.length > 0);
  }, [labs, search, statusFilter]);

  /*
   * =========================================================
   * SUMMARY
   * =========================================================
   */

  const summary = useMemo(() => {
    let totalSeats = 0;
    let fixedSeats = 0;
    let occupiedSeats = 0;

    labs.forEach((lab) => {
      (lab.rows ?? []).forEach((row) => {
        (row.seats ?? []).forEach((seat) => {
          totalSeats += 1;

          const status = String(seat.status ?? "").toUpperCase();

          if (status === "FIXED") {
            fixedSeats += 1;
          }

          if (status === "OCCUPIED") {
            occupiedSeats += 1;
          }
        });
      });
    });

    const availableSeats = Math.max(totalSeats - fixedSeats - occupiedSeats, 0);

    return {
      totalSeats,
      fixedSeats,
      occupiedSeats,
      availableSeats,
    };
  }, [labs]);

  /*
   * =========================================================
   * HANDLERS
   * =========================================================
   */

  const handleSeatClick = (seat: Seat) => {
    setSelectedSeat({
      ...seat,
      viewingShift: selectedShift?.name ?? "",
      viewingShiftCode: selectedShift?.code ?? "",
      viewingDate: date,
    });
  };

  const handleCloseModal = () => {
    setSelectedSeat(null);
  };

  const handleSuccess = async () => {
    setSelectedSeat(null);

    await queryClient.invalidateQueries({
      queryKey: ["seat-map", date, shiftId],
    });
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setSelectedSeat(null);
  };

  const handleShiftChange = (value: string) => {
    setShiftId(value);
    setSelectedSeat(null);
    setSearch("");
    setStatusFilter("ALL");
  };

  const clearStudentFromUrl = () => {
    if (!searchParams.has("studentId")) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    nextParams.delete("studentId");

    setSearchParams(nextParams, {
      replace: true,
    });
  };

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

  const isFullDay =
    selectedShift?.code === "FULL_DAY" ||
    selectedShift?.name?.toLowerCase() === "full day";

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="min-h-full bg-[#faf9f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight text-stone-900 sm:text-2xl">
              Seat Map
            </h1>

            <p className="mt-1 text-xs text-stone-500 sm:text-sm">
              Assign and manage seats by date and shift.
            </p>
          </div>

          {shiftId && (
            <div className="hidden pt-1 text-right text-xs text-stone-500 sm:block">
              Viewing{" "}
              <span className="font-medium text-stone-700">
                {selectedShift?.name ?? "Shift"}
              </span>{" "}
              on{" "}
              <span className="font-medium text-stone-700">
                {formattedDate}
              </span>
            </div>
          )}
        </div>

        {/* =====================================================
            CONTROLS
        ===================================================== */}

        <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-100/70 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex w-full flex-col sm:w-[180px]">
              <label className="mb-1.5 text-xs font-medium text-stone-600">
                Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="
                  h-10
                  rounded-lg
                  border
                  border-stone-300
                  bg-white
                  px-3
                  text-sm
                  text-stone-700
                  outline-none
                  transition
                  focus:border-amber-500
                  focus:ring-1
                  focus:ring-amber-500
                "
              />
            </div>

            <div className="flex w-full flex-col sm:w-[240px]">
              <label className="mb-1.5 text-xs font-medium text-stone-600">
                Shift
              </label>

              <select
                value={shiftId}
                onChange={(e) => handleShiftChange(e.target.value)}
                disabled={shiftsQuery.isLoading}
                className="
                  h-10
                  rounded-lg
                  border
                  border-stone-300
                  bg-white
                  px-3
                  text-sm
                  text-stone-700
                  outline-none
                  transition
                  focus:border-amber-500
                  focus:ring-1
                  focus:ring-amber-500
                "
              >
                <option value="">Select shift</option>

                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name ?? shift.code ?? "Shift"}
                  </option>
                ))}
              </select>
            </div>

            {shiftId && (
              <div
                className="
                  flex
                  min-h-10
                  items-center
                  rounded-lg
                  border
                  border-amber-200
                  bg-amber-50
                  px-3
                  py-2
                  text-xs
                  text-amber-700
                "
              >
                <div>
                  <div className="font-medium">
                    {isFullDay
                      ? "Full Day View"
                      : (selectedShift?.name ?? "Shift")}
                  </div>

                  <div className="mt-0.5">
                    {isFullDay
                      ? formattedDate
                      : `${selectedShift?.name ?? "Shift"} · ${formattedDate}`}
                  </div>
                </div>
              </div>
            )}

            {preselectedStudentId && (
              <div className="flex min-h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>Student selected for seat assignment.</span>

                <button
                  type="button"
                  onClick={clearStudentFromUrl}
                  className="font-medium underline hover:no-underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        {shiftId && !seatMapQuery.isLoading && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="TOTAL SEATS"
              value={summary.totalSeats}
              description="Across all labs"
              valueClass="text-stone-900"
            />

            <SummaryCard
              label="AVAILABLE"
              value={summary.availableSeats}
              description="Can be assigned"
              valueClass="text-emerald-600"
            />

            <SummaryCard
              label="OCCUPIED"
              value={summary.occupiedSeats}
              description="Current occupancy"
              valueClass="text-amber-600"
            />

            <SummaryCard
              label="FIXED"
              value={summary.fixedSeats}
              description="Membership locked"
              valueClass="text-stone-900"
            />
          </div>
        )}

        {/* =====================================================
            FILTER BAR
        ===================================================== */}

        {shiftId && !seatMapQuery.isLoading && (
          <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={statusFilter === "ALL"}
                  label={`All ${summary.totalSeats}`}
                  onClick={() => setStatusFilter("ALL")}
                />

                <FilterButton
                  active={statusFilter === "FREE"}
                  label={`Available ${summary.availableSeats}`}
                  onClick={() => setStatusFilter("FREE")}
                />

                <FilterButton
                  active={statusFilter === "OCCUPIED"}
                  label={`Occupied ${summary.occupiedSeats}`}
                  onClick={() => setStatusFilter("OCCUPIED")}
                />

                <FilterButton
                  active={statusFilter === "FIXED"}
                  label={`Fixed ${summary.fixedSeats}`}
                  onClick={() => setStatusFilter("FIXED")}
                />
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search seat or student..."
                className="
                    h-9
                    w-full
                    rounded-lg
                    border
                    border-stone-300
                    bg-white
                    px-3
                    text-xs
                    text-stone-700
                    outline-none
                    placeholder:text-stone-400
                    focus:border-amber-500
                    focus:ring-1
                    focus:ring-amber-500
                    lg:w-[300px]
                  "
              />
            </div>
          </div>
        )}

        {/* =====================================================
            LEGEND
        ===================================================== */}

        {shiftId && !seatMapQuery.isLoading && (
          <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <SeatLegend allocationMode />

            {isFullDay && (
              <span className="text-[10px] text-stone-400 sm:text-xs">
                Full Day includes Morning + Evening occupancy
              </span>
            )}
          </div>
        )}

        {/* =====================================================
            MAP AREA
        ===================================================== */}

        <div className="rounded-2xl border border-stone-200 bg-stone-100/60 p-3 sm:p-4">
          {shiftsQuery.isLoading && <EmptyState message="Loading shifts..." />}

          {!shiftId && !shiftsQuery.isLoading && (
            <EmptyState
              title="Select a shift"
              message="Choose a date and shift to manage seat allocation."
            />
          )}

          {shiftId && seatMapQuery.isLoading && (
            <EmptyState message="Loading seat map..." />
          )}

          {shiftId &&
            !seatMapQuery.isLoading &&
            !seatMapQuery.isError &&
            labs.length === 0 && (
              <EmptyState
                title="No seats available"
                message="No seats were returned for the selected shift."
              />
            )}

          {shiftId &&
            !seatMapQuery.isLoading &&
            !seatMapQuery.isError &&
            labs.length > 0 &&
            filteredLabs.length === 0 && (
              <EmptyState
                title="No matching seats"
                message="Try changing the search or seat status filter."
              />
            )}

          {seatMapQuery.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-700">
                Failed to load the seat map.
              </p>

              <p className="mt-1 text-xs text-red-600">
                Please try changing the date or shift.
              </p>
            </div>
          )}

          {shiftId &&
            !seatMapQuery.isLoading &&
            !seatMapQuery.isError &&
            filteredLabs.length > 0 && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredLabs.map((lab) => (
                  <LabSection
                    key={lab.labId}
                    lab={lab}
                    onSeatClick={handleSeatClick}
                  />
                ))}
              </div>
            )}
        </div>

        {/* =====================================================
            ASSIGN MODAL
        ===================================================== */}

        {selectedSeat && (
          <AssignSeatModal
            seat={selectedSeat}
            shiftId={shiftId}
            date={date}
            preselectedStudentId={preselectedStudentId}
            onClose={handleCloseModal}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  description,
  valueClass,
}: {
  label: string;
  value: number;
  description: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-medium tracking-wide text-stone-400">
        {label}
      </div>

      <div className={`mt-1 text-2xl font-medium ${valueClass}`}>{value}</div>

      <div className="mt-0.5 text-[10px] text-stone-500">{description}</div>
    </div>
  );
}

/* =========================================================
   FILTER BUTTON
========================================================= */

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 text-xs transition",
        active
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({ title, message }: { title?: string; message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-6 text-center">
      <div>
        {title && <p className="text-sm font-medium text-stone-700">{title}</p>}

        <p className="mt-1 text-xs text-stone-500">{message}</p>
      </div>
    </div>
  );
}
