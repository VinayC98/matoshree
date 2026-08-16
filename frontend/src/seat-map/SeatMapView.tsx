import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSeatMap } from "../api/seatMap.api";
import { getShifts } from "../api/memberships.api";

type FilterType = "ALL" | "FREE" | "OCCUPIED" | "FIXED";

type Shift = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type ApiStudent = {
  id?: string | null;
  name?: string | null;
  mobile?: string | null;
  validTill?: string | null;
  membershipType?: string | null;
};

type ApiShiftReference = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
};

type ApiOccupant = {
  studentId?: string | null;
  studentName?: string | null;
  name?: string | null;
  mobile?: string | null;
  shiftId?: string | null;
  shiftCode?: string | null;
  shiftName?: string | null;
  validTill?: string | null;
  endDate?: string | null;
  membershipEndDate?: string | null;
  membershipType?: string | null;
  student?: ApiStudent | null;
  shift?: ApiShiftReference | null;
};

type ApiSeat = {
  seatId?: string | null;
  id?: string | null;
  seatNumber: number | string;
  status?: string | null;
  isFixed?: boolean | null;
  isFixedLocked?: boolean | null;
  blockedByShift?: string | null;
  blockedByShiftName?: string | null;
  occupants?: ApiOccupant[] | null;
};

type ApiRow = {
  rowNumber: number | string;
  seats?: ApiSeat[] | null;
};

type ApiLab = {
  labId: string;
  labName: string;
  rows?: ApiRow[] | null;
};

type Occupant = {
  name: string;
  mobile?: string;
  shiftName?: string;
  shiftCode?: string;
  validTill?: string;
  membershipType?: string;
};

type NormalizedSeat = {
  seatId: string;
  seatNumber: number | string;
  status: string;
  labName: string;
  rowNumber: number | string;
  occupants: Occupant[];
  blockedByShift?: string;
  isFixed: boolean;
  isOccupied: boolean;
  isFree: boolean;
};

type NormalizedRow = {
  rowNumber: number | string;
  seats: NormalizedSeat[];
};

type NormalizedLab = {
  labId: string;
  labName: string;
  rows: NormalizedRow[];
};

type LabSummary = {
  total: number;
  fixed: number;
  occupied: number;
  free: number;
};

type SeatMapResponse = ApiLab[];

function getTodayLocalDate(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getOccupants(seat: ApiSeat): Occupant[] {
  if (!Array.isArray(seat.occupants)) {
    return [];
  }

  const unique = new Map<string, Occupant>();

  for (const occupant of seat.occupants) {
    if (!occupant) {
      continue;
    }

    const name =
      occupant.studentName ?? occupant.student?.name ?? occupant.name ?? "";

    const trimmedName = name.trim();

    if (!trimmedName) {
      continue;
    }

    const studentId = occupant.studentId ?? occupant.student?.id ?? "";

    const shiftCode = occupant.shiftCode ?? occupant.shift?.code ?? "";

    const shiftName = occupant.shiftName ?? occupant.shift?.name ?? "";

    const key = studentId
      ? `${studentId}:${shiftCode}`
      : `${trimmedName.toLowerCase()}:${shiftCode}`;

    unique.set(key, {
      name: trimmedName,
      mobile: occupant.mobile ?? occupant.student?.mobile ?? undefined,
      shiftName: shiftName || undefined,
      shiftCode: shiftCode || undefined,
      validTill:
        occupant.validTill ??
        occupant.endDate ??
        occupant.membershipEndDate ??
        occupant.student?.validTill ??
        undefined,
      membershipType:
        occupant.membershipType ??
        occupant.student?.membershipType ??
        undefined,
    });
  }

  return Array.from(unique.values());
}

function matchesSearch(seat: NormalizedSeat, search: string): boolean {
  const value = search.trim().toLowerCase();

  if (!value) {
    return true;
  }

  if (String(seat.seatNumber).toLowerCase().includes(value)) {
    return true;
  }

  if (seat.labName.toLowerCase().includes(value)) {
    return true;
  }

  return seat.occupants.some((occupant) =>
    [occupant.name, occupant.mobile, occupant.shiftName, occupant.shiftCode]
      .filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
      .join(" ")
      .toLowerCase()
      .includes(value),
  );
}

function matchesFilter(seat: NormalizedSeat, filter: FilterType): boolean {
  switch (filter) {
    case "FREE":
      return seat.isFree;

    case "OCCUPIED":
      return seat.isOccupied && !seat.isFixed;

    case "FIXED":
      return seat.isFixed;

    case "ALL":
    default:
      return true;
  }
}

export default function SeatMapView() {
  const [date, setDate] = useState(getTodayLocalDate);
  const [shiftId, setShiftId] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");

  /*
   * =========================================================
   * SHIFTS
   * =========================================================
   */

  const shiftsQuery = useQuery<Shift[]>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const result = await getShifts();

      return Array.isArray(result) ? (result as Shift[]) : [];
    },
  });

  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data]);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === shiftId),
    [shifts, shiftId],
  );

  const selectedShiftCode = String(selectedShift?.code ?? "").toUpperCase();

  const isFullDay =
    selectedShiftCode === "FULL_DAY" ||
    selectedShift?.name?.toLowerCase() === "full day";

  /*
   * =========================================================
   * SEAT MAP
   * =========================================================
   */

  const seatMapQuery = useQuery<SeatMapResponse>({
    queryKey: ["seat-map-view", date, shiftId],
    queryFn: async () => {
      const result = await getSeatMap({
        date,
        shiftId,
      });

      return Array.isArray(result) ? (result as SeatMapResponse) : [];
    },
    enabled: Boolean(shiftId),
  });

  /*
   * =========================================================
   * NORMALIZED MAP
   * =========================================================
   */

  const normalizedLabs = useMemo<NormalizedLab[]>(() => {
    const labs = seatMapQuery.data ?? [];

    return labs.map((lab) => ({
      labId: lab.labId,
      labName: lab.labName,

      rows: (lab.rows ?? []).map((row) => ({
        rowNumber: row.rowNumber,

        seats: (row.seats ?? []).map((seat) => {
          const occupants = getOccupants(seat);

          const status = String(seat.status ?? "FREE").toUpperCase();

          const isFixed =
            status === "FIXED" ||
            seat.isFixed === true ||
            seat.isFixedLocked === true;

          const isOccupied =
            !isFixed && (status === "OCCUPIED" || occupants.length > 0);

          const isFree = !isFixed && !isOccupied;

          const seatId =
            seat.seatId ??
            seat.id ??
            `${lab.labId}-${row.rowNumber}-${seat.seatNumber}`;

          return {
            seatId,
            seatNumber: seat.seatNumber,
            status,
            labName: lab.labName,
            rowNumber: row.rowNumber,
            occupants,
            blockedByShift:
              seat.blockedByShift ?? seat.blockedByShiftName ?? undefined,
            isFixed,
            isOccupied,
            isFree,
          };
        }),
      })),
    }));
  }, [seatMapQuery.data]);

  /*
   * =========================================================
   * ALL SEATS
   * =========================================================
   */

  const allSeats = useMemo(
    () => normalizedLabs.flatMap((lab) => lab.rows.flatMap((row) => row.seats)),
    [normalizedLabs],
  );

  /*
   * =========================================================
   * SUMMARY
   * =========================================================
   */

  const summary = useMemo(() => {
    const total = allSeats.length;

    const fixed = allSeats.filter((seat) => seat.isFixed).length;

    const occupied = allSeats.filter(
      (seat) => seat.isOccupied && !seat.isFixed,
    ).length;

    const free = allSeats.filter((seat) => seat.isFree).length;

    const occupiedStudents = allSeats.reduce(
      (totalCount, seat) => totalCount + seat.occupants.length,
      0,
    );

    return {
      total,
      fixed,
      occupied,
      free,
      occupiedStudents,
    };
  }, [allSeats]);

  /*
   * =========================================================
   * FILTERED LABS
   * =========================================================
   */

  const filteredLabs = useMemo<NormalizedLab[]>(() => {
    return normalizedLabs
      .map((lab) => ({
        ...lab,

        rows: lab.rows
          .map((row) => ({
            ...row,

            seats: row.seats.filter(
              (seat) =>
                matchesSearch(seat, search) && matchesFilter(seat, filter),
            ),
          }))
          .filter((row) => row.seats.length > 0),
      }))
      .filter((lab) => lab.rows.length > 0);
  }, [normalizedLabs, filter, search]);

  /*
   * =========================================================
   * LAB SUMMARY
   * =========================================================
   */

  const getLabSummary = (lab: NormalizedLab): LabSummary => {
    const seats = lab.rows.flatMap((row) => row.seats);

    return {
      total: seats.length,
      fixed: seats.filter((seat) => seat.isFixed).length,
      occupied: seats.filter((seat) => seat.isOccupied && !seat.isFixed).length,
      free: seats.filter((seat) => seat.isFree).length,
    };
  };

  /*
   * =========================================================
   * FORMAT DATE
   * =========================================================
   */

  const formatDate = (value: string): string => {
    if (!value) {
      return "";
    }

    const [year, month, day] = value.split("-");

    if (!year || !month || !day) {
      return "";
    }

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  /*
   * =========================================================
   * SEAT TOOLTIP
   * =========================================================
   */

  const buildTooltip = (seat: NormalizedSeat): string => {
    const lines = [
      `Seat ${seat.seatNumber}`,
      `Status: ${
        seat.isFixed ? "Fixed Seat" : seat.isOccupied ? "Occupied" : "Free"
      }`,
    ];

    if (seat.occupants.length > 0) {
      lines.push("");

      seat.occupants.forEach((occupant, index) => {
        lines.push(`${index + 1}. ${occupant.name}`);

        if (occupant.shiftName) {
          lines.push(`   Shift: ${occupant.shiftName}`);
        }

        if (occupant.validTill) {
          lines.push(
            `   Valid till: ${new Date(occupant.validTill).toLocaleDateString(
              "en-IN",
            )}`,
          );
        }
      });
    }

    if (seat.blockedByShift) {
      lines.push(`Blocked by: ${seat.blockedByShift}`);
    }

    return lines.join("\n");
  };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5 lg:px-8">
        <div className="mb-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">
                Seat Overview
              </h1>

              <p className="text-xs text-stone-500 sm:text-sm">
                Daily occupancy and seat availability
              </p>
            </div>

            {seatMapQuery.data && shiftId && (
              <div className="text-xs text-stone-500">
                Viewing{" "}
                <span className="font-medium text-stone-700">
                  {selectedShift?.name ?? "Selected Shift"}
                </span>{" "}
                on{" "}
                <span className="font-medium text-stone-700">
                  {formatDate(date)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-100/80 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_240px_1fr] md:items-end">
            <div className="flex flex-col text-sm">
              <label className="mb-1 text-xs font-medium text-stone-600">
                Date
              </label>

              <input
                type="date"
                className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col text-sm">
              <label className="mb-1 text-xs font-medium text-stone-600">
                Shift
              </label>

              <select
                className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                value={shiftId}
                onChange={(event) => {
                  setShiftId(event.target.value);
                  setFilter("ALL");
                  setSearch("");
                }}
                disabled={shiftsQuery.isLoading}
              >
                <option value="">Select shift</option>

                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name ?? shift.code ?? "Shift"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-h-10 items-center">
              {isFullDay && (
                <div className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <div>
                    <div className="font-semibold">Full Day View</div>

                    <div className="mt-0.5 text-amber-700">
                      Shows Morning + Evening occupancy
                    </div>
                  </div>
                </div>
              )}

              {!isFullDay && selectedShift && (
                <div className="inline-flex rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
                  {selectedShift.name ?? selectedShift.code ?? "Selected Shift"}{" "}
                  occupancy
                </div>
              )}
            </div>
          </div>
        </div>

        {shiftId && (
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              label="Total Seats"
              value={summary.total}
              description="Across all labs"
              valueClass="text-stone-800"
            />

            <SummaryCard
              label="Available"
              value={summary.free}
              description="Can be assigned"
              valueClass="text-emerald-700"
            />

            <SummaryCard
              label="Occupied"
              value={summary.occupied}
              description={
                isFullDay
                  ? `${summary.occupiedStudents} student occupancy`
                  : "Currently occupied"
              }
              valueClass="text-amber-700"
            />

            <SummaryCard
              label="Fixed"
              value={summary.fixed}
              description="Membership locked"
              valueClass="text-stone-600"
            />
          </div>
        )}

        {shiftId && (
          <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <FilterButton
                  active={filter === "ALL"}
                  label="All"
                  count={summary.total}
                  onClick={() => setFilter("ALL")}
                />

                <FilterButton
                  active={filter === "FREE"}
                  label="Available"
                  count={summary.free}
                  onClick={() => setFilter("FREE")}
                />

                <FilterButton
                  active={filter === "OCCUPIED"}
                  label="Occupied"
                  count={summary.occupied}
                  onClick={() => setFilter("OCCUPIED")}
                />

                <FilterButton
                  active={filter === "FIXED"}
                  label="Fixed"
                  count={summary.fixed}
                  onClick={() => setFilter("FIXED")}
                />
              </div>

              <div className="relative w-full lg:max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search seat or student..."
                  className="h-9 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 pr-8 text-sm outline-none transition focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {shiftId && (
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-600 shadow-sm">
            <LegendItem color="bg-emerald-600" label="Available" />

            <LegendItem color="bg-amber-600" label="Occupied" />

            <LegendItem color="bg-stone-500" label="Fixed Seat" />

            {isFullDay && (
              <span className="ml-auto text-stone-400">
                Full Day includes Morning + Evening
              </span>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-stone-100/60 p-2 sm:p-4">
          {!shiftId && (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-4 text-center">
              <div>
                <div className="mb-1 text-sm font-medium text-stone-700">
                  Select a shift
                </div>

                <div className="text-xs text-stone-500">
                  Choose a shift above to view seat occupancy.
                </div>
              </div>
            </div>
          )}

          {shiftId && seatMapQuery.isLoading && (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl bg-white">
              <div className="text-sm text-stone-500">Loading seat map…</div>
            </div>
          )}

          {shiftId && seatMapQuery.isError && (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-red-200 bg-red-50">
              <div className="text-center">
                <div className="text-sm font-medium text-red-700">
                  Unable to load seat map
                </div>

                <div className="mt-1 text-xs text-red-600">
                  Please try again.
                </div>

                <button
                  type="button"
                  onClick={() => void seatMapQuery.refetch()}
                  className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {shiftId &&
            !seatMapQuery.isLoading &&
            !seatMapQuery.isError &&
            normalizedLabs.length === 0 && (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl bg-white">
                <div className="text-center">
                  <div className="text-sm font-medium text-stone-700">
                    No seats available
                  </div>

                  <div className="mt-1 text-xs text-stone-500">
                    There are no seats configured for this view.
                  </div>
                </div>
              </div>
            )}

          {shiftId &&
            !seatMapQuery.isLoading &&
            !seatMapQuery.isError &&
            normalizedLabs.length > 0 &&
            filteredLabs.length === 0 && (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl bg-white">
                <div className="text-center">
                  <div className="text-sm font-medium text-stone-700">
                    No matching seats
                  </div>

                  <div className="mt-1 text-xs text-stone-500">
                    Try another filter or search.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFilter("ALL");
                      setSearch("");
                    }}
                    className="mt-3 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}

          {filteredLabs.length > 0 && (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filteredLabs.map((lab) => {
                const labSummary = getLabSummary(lab);

                return (
                  <LabCard
                    key={lab.labId}
                    lab={lab}
                    labSummary={labSummary}
                    isFullDay={isFullDay}
                    buildTooltip={buildTooltip}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>

      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>

      <div className="mt-0.5 text-[11px] text-stone-500">{description}</div>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-amber-700 text-white shadow-sm"
          : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
      ].join(" ")}
    >
      {label}

      <span
        className={active ? "ml-1.5 text-amber-100" : "ml-1.5 text-stone-400"}
      >
        {count}
      </span>
    </button>
  );
}

function LabCard({
  lab,
  labSummary,
  isFullDay,
  buildTooltip,
}: {
  lab: NormalizedLab;
  labSummary: LabSummary;
  isFullDay: boolean;
  buildTooltip: (seat: NormalizedSeat) => string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-800 sm:text-base">
              {lab.labName}
            </h2>

            <div className="mt-1 h-0.5 w-10 rounded bg-amber-600" />
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] text-stone-500">
            <span>{labSummary.total} seats</span>

            <span className="text-emerald-600">
              {labSummary.free} available
            </span>

            <span className="text-amber-600">
              {labSummary.occupied} occupied
            </span>

            {labSummary.fixed > 0 && (
              <span className="text-stone-500">{labSummary.fixed} fixed</span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="min-w-[360px] space-y-3">
          {lab.rows.map((row) => (
            <div
              key={row.rowNumber}
              className="flex items-start gap-2 sm:gap-3"
            >
              <div className="w-6 shrink-0 pt-2 text-[10px] font-medium text-stone-400 sm:w-8 sm:text-xs">
                R{row.rowNumber}
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {row.seats.map((seat) => (
                  <SeatView
                    key={seat.seatId}
                    seat={seat}
                    isFullDay={isFullDay}
                    tooltip={buildTooltip(seat)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeatView({
  seat,
  isFullDay,
  tooltip,
}: {
  seat: NormalizedSeat;
  isFullDay: boolean;
  tooltip: string;
}) {
  let bg = "bg-emerald-600";
  let ring = "";

  if (seat.isFixed) {
    bg = "bg-stone-500";
    ring = "ring-2 ring-stone-300";
  } else if (seat.isOccupied) {
    bg = "bg-amber-600";
  }

  const occupantCount = seat.occupants.length;

  return (
    <div title={tooltip} className="group relative">
      <div
        className={[
          "relative flex h-9 w-9 cursor-default items-center justify-center rounded-lg",
          "text-[11px] font-semibold text-white sm:h-10 sm:w-10 sm:text-xs",
          "transition-all duration-150",
          "group-hover:-translate-y-0.5 group-hover:shadow-md",
          bg,
          ring,
        ].join(" ")}
      >
        {seat.seatNumber}

        {seat.isFixed && (
          <span className="absolute -right-1 -top-1 rounded bg-stone-800 px-1 py-0.5 text-[7px] font-bold leading-none text-white sm:text-[8px]">
            F
          </span>
        )}

        {isFullDay && !seat.isFixed && occupantCount > 1 && (
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-stone-800 px-1 text-[8px] font-bold text-white">
            {occupantCount}
          </span>
        )}

        {isFullDay && !seat.isFixed && occupantCount === 1 && (
          <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-800" />
        )}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-56 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-xs shadow-xl group-hover:block">
        <div className="font-semibold text-stone-800">
          Seat {seat.seatNumber}
        </div>

        <div className="mt-1 text-stone-500">
          {seat.isFixed
            ? "Fixed Seat"
            : seat.isOccupied
              ? "Occupied"
              : "Available"}
        </div>

        {seat.occupants.length > 0 && (
          <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
            {seat.occupants.map((occupant, index) => (
              <div
                key={`${occupant.name}-${index}`}
                className="rounded-lg bg-stone-50 p-2"
              >
                <div className="font-medium text-stone-800">
                  {occupant.name}
                </div>

                {occupant.shiftName && (
                  <div className="mt-0.5 text-stone-500">
                    {occupant.shiftName}
                  </div>
                )}

                {occupant.validTill && (
                  <div className="mt-0.5 text-[10px] text-stone-400">
                    Valid till{" "}
                    {new Date(occupant.validTill).toLocaleDateString("en-IN")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {seat.blockedByShift && (
          <div className="mt-2 border-t border-stone-100 pt-2 text-stone-500">
            Blocked by{" "}
            <span className="font-medium text-stone-700">
              {seat.blockedByShift}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${color}`} />

      <span>{label}</span>
    </div>
  );
}
