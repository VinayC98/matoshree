import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Armchair,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  IndianRupee,
  Layers,
  Users,
  WalletCards,
  LucideIcon,
} from "lucide-react";

import { getDashboard } from "../api/dashboard.api";
import RevenueChart from "./components/RevenueChart";

/* =========================================================
   TYPES
========================================================= */

type DashboardShift = {
  shiftId: string;
  shiftCode?: string;
  shiftName: string;
  occupiedSeats: number;
  availableSeats: number;
};

type RevenueTrendItem = {
  date: string;
  amount: number;
};

type DashboardData = {
  summary: {
    totalStudents: number;
    activeMemberships: number;
    totalSeats: number;
    fixedSeats: number;
    occupiedSeatsToday: number;
    availableSeatsToday: number;
  };

  seatUtilization: {
    byShift: DashboardShift[];
  };

  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
    trend: RevenueTrendItem[];
  };
};

/* =========================================================
   COMPONENT
========================================================= */

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  /*
   * IMPORTANT:
   *
   * There are intentionally NO hooks below this point.
   *
   * This prevents:
   *
   * "Rendered more hooks than during the previous render."
   */

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <DashboardError
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  /* =======================================================
     NORMALIZED DATA
  ======================================================= */

  const shifts = Array.isArray(data.seatUtilization?.byShift)
    ? data.seatUtilization.byShift
    : [];

  const totalStudents = toNumber(data.summary?.totalStudents);

  const activeMemberships = toNumber(data.summary?.activeMemberships);

  const totalSeats = toNumber(data.summary?.totalSeats);

  const fixedSeats = toNumber(data.summary?.fixedSeats);

  const occupiedSeatsToday = toNumber(data.summary?.occupiedSeatsToday);

  /*
   * Use the API's availableSeatsToday when supplied.
   *
   * If it is missing/invalid, calculate a safe fallback.
   */
  const apiAvailableSeats = Number(data.summary?.availableSeatsToday);

  const calculatedAvailableSeats = Math.max(
    totalSeats - fixedSeats - occupiedSeatsToday,
    0,
  );

  const availableSeatsToday = Number.isFinite(apiAvailableSeats)
    ? Math.max(apiAvailableSeats, 0)
    : calculatedAvailableSeats;

  /* =======================================================
     OVERALL SEAT TOTALS
  ======================================================= */

  /*
   * Do NOT sum available/occupied seats across shifts.
   *
   * A physical seat can appear in more than one shift.
   *
   * Example:
   *
   * Evening Shift -> 138 available
   * Full Day      -> 138 available
   * Morning Shift -> 138 available
   *
   * That does NOT mean 414 physical seats exist.
   *
   * The overall dashboard therefore uses the API's daily
   * summary values, while individual shift cards continue
   * to use their own shift-level values.
   */
  const overallUsableSeatCapacity = Math.max(totalSeats - fixedSeats, 0);

  const overallUtilization =
    overallUsableSeatCapacity > 0
      ? Math.min(
          Math.round((occupiedSeatsToday / overallUsableSeatCapacity) * 100),
          100,
        )
      : 0;

  /* =======================================================
     ATTENTION
  ======================================================= */

  const attentionItems = buildAttentionItems(
    shifts,
    totalSeats,
    availableSeatsToday,
    activeMemberships,
  );

  /* =======================================================
     REVENUE
  ======================================================= */

  const revenue = {
    today: toNumber(data.revenue?.today),
    week: toNumber(data.revenue?.week),
    month: toNumber(data.revenue?.month),
    year: toNumber(data.revenue?.year),
  };

  const revenueTrend = Array.isArray(data.revenue?.trend)
    ? data.revenue.trend
    : [];

  const revenueDirection = getRevenueTrendDirection(revenueTrend);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-stone-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-800">
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-stone-500">
              Daily overview of students, seats and revenue.
            </p>
          </div>

          <div
            className="
              inline-flex
              w-fit
              items-center
              gap-2
              rounded-lg
              border
              border-stone-200
              bg-white
              px-3
              py-2
              text-xs
              text-stone-500
              shadow-sm
            "
          >
            <CalendarDays size={14} className="text-stone-400" />

            <span>{formatCurrentDate()}</span>
          </div>
        </div>

        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Students"
            value={totalStudents}
            subtitle="Registered students"
            icon={Users}
            iconClass="bg-blue-50 text-blue-700"
            accentClass="bg-blue-500"
          />

          <SummaryCard
            title="Active Memberships"
            value={activeMemberships}
            subtitle={
              totalStudents > 0
                ? `${Math.round(
                    (activeMemberships / totalStudents) * 100,
                  )}% of students active`
                : "No active memberships"
            }
            icon={BadgeCheck}
            iconClass="bg-green-50 text-green-700"
            accentClass="bg-green-500"
          />

          <SummaryCard
            title="Total Seats"
            value={totalSeats}
            subtitle={`${fixedSeats} fixed seats`}
            icon={Layers}
            iconClass="bg-stone-100 text-stone-700"
            accentClass="bg-stone-400"
          />

          <SummaryCard
            title="Available Today"
            value={availableSeatsToday}
            subtitle={
              overallUtilization > 0
                ? `${overallUtilization}% overall utilization`
                : "No occupancy yet"
            }
            icon={Armchair}
            iconClass={
              availableSeatsToday > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
            }
            accentClass={
              availableSeatsToday > 0 ? "bg-amber-500" : "bg-red-500"
            }
            highlight={availableSeatsToday <= 5}
          />
        </div>

        {/* =================================================
            TODAY'S SEAT OVERVIEW
        ================================================= */}

        <section
          className="
            overflow-hidden
            rounded-2xl
            border
            border-stone-200
            bg-white
            shadow-sm
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3
              border-b
              border-stone-100
              px-4
              py-4
              sm:flex-row
              sm:items-center
              sm:justify-between
              sm:px-5
            "
          >
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    bg-stone-100
                    text-stone-600
                  "
                >
                  <Armchair size={16} />
                </div>

                <h2 className="text-sm font-semibold text-stone-800">
                  Today's Seat Overview
                </h2>
              </div>

              <p className="mt-1 text-xs text-stone-500">
                Occupancy and availability across each shift.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-stone-500">
                <span className="h-2 w-2 rounded-full bg-amber-600" />
                {occupiedSeatsToday} occupied
              </span>

              <span className="inline-flex items-center gap-1.5 text-stone-500">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                {availableSeatsToday} available
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-3">
            {shifts.map((shift) => (
              <ShiftUtilizationCard key={shift.shiftId} shift={shift} />
            ))}

            {shifts.length === 0 && <EmptyShiftState />}
          </div>
        </section>

        {/* =================================================
            ATTENTION NEEDED
        ================================================= */}

        <AttentionSection items={attentionItems} />

        {/* =================================================
            REVENUE + ADMIN SNAPSHOT
        ================================================= */}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
          {/* REVENUE */}

          <section
            className="
              overflow-hidden
              rounded-2xl
              border
              border-stone-200
              bg-white
              shadow-sm
            "
          >
            <div
              className="
                flex
                flex-col
                gap-3
                border-b
                border-stone-100
                px-4
                py-4
                sm:flex-row
                sm:items-center
                sm:justify-between
                sm:px-5
              "
            >
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-lg
                      bg-green-50
                      text-green-700
                    "
                  >
                    <WalletCards size={16} />
                  </div>

                  <h2 className="text-sm font-semibold text-stone-800">
                    Revenue
                  </h2>
                </div>

                <p className="mt-1 text-xs text-stone-500">
                  Payments actually received.
                </p>
              </div>

              <RevenueTrendIndicator direction={revenueDirection} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4">
              <RevenueMetric label="Today" value={revenue.today} />

              <RevenueMetric label="This Week" value={revenue.week} />

              <RevenueMetric
                label="This Month"
                value={revenue.month}
                emphasized
              />

              <RevenueMetric label="This Year" value={revenue.year} />
            </div>
          </section>

          {/* ADMIN SNAPSHOT */}

          <AdminSnapshot
            totalStudents={totalStudents}
            activeMemberships={activeMemberships}
            availableSeats={availableSeatsToday}
            monthlyRevenue={revenue.month}
          />
        </div>

        {/* =================================================
            REVENUE TREND
        ================================================= */}

        <RevenueChart trend={revenueTrend} />
      </div>
    </div>
  );
}

/* =========================================================
   ATTENTION ITEM TYPE
========================================================= */

type AttentionItem = {
  id: string;
  title: string;
  description: string;
  value: string;
  severity: "high" | "medium" | "info";
};

/* =========================================================
   BUILD ATTENTION ITEMS
========================================================= */

function buildAttentionItems(
  shifts: DashboardShift[],
  totalSeats: number,
  availableSeats: number,
  activeMemberships: number,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  /*
   * No active memberships.
   */

  if (activeMemberships === 0) {
    items.push({
      id: "no-active-memberships",
      title: "No active memberships",
      description: "There are currently no active memberships in the system.",
      value: "Review",
      severity: "medium",
    });
  }

  /*
   * No seats at all.
   */

  if (totalSeats === 0) {
    items.push({
      id: "no-seats",
      title: "No seats configured",
      description: "No seats are currently configured for the study lab.",
      value: "Setup required",
      severity: "high",
    });
  }

  /*
   * No availability.
   */

  if (totalSeats > 0 && availableSeats <= 0) {
    items.push({
      id: "no-available-seats",
      title: "No seats available",
      description: "All currently usable seats are unavailable today.",
      value: "Full",
      severity: "high",
    });
  }

  /*
   * Very low overall availability.
   */

  if (
    totalSeats > 0 &&
    availableSeats > 0 &&
    availableSeats <= Math.max(3, Math.ceil(totalSeats * 0.05))
  ) {
    items.push({
      id: "low-overall-availability",
      title: "Seat availability is low",
      description: "Only a small number of seats remain available today.",
      value: `${availableSeats} left`,
      severity: "high",
    });
  }

  /*
   * Shift-level attention.
   */

  shifts.forEach((shift) => {
    const occupied = toNumber(shift.occupiedSeats);

    const available = toNumber(shift.availableSeats);

    const total = occupied + available;

    if (total <= 0) {
      return;
    }

    const utilization = (occupied / total) * 100;

    /*
     * Very high occupancy.
     */

    if (utilization >= 90) {
      items.push({
        id: `shift-critical-${shift.shiftId}`,
        title: `${shift.shiftName} is nearly full`,
        description:
          "Seat occupancy is above 90%. Monitor availability closely.",
        value: `${Math.round(utilization)}% full`,
        severity: "high",
      });

      return;
    }

    /*
     * High occupancy.
     */

    if (utilization >= 80) {
      items.push({
        id: `shift-high-${shift.shiftId}`,
        title: `${shift.shiftName} has high occupancy`,
        description: "Most seats in this shift are currently occupied.",
        value: `${Math.round(utilization)}% full`,
        severity: "medium",
      });

      return;
    }

    /*
     * Low remaining seats.
     */

    if (available > 0 && available <= 5) {
      items.push({
        id: `shift-low-${shift.shiftId}`,
        title: `${shift.shiftName} has limited availability`,
        description: "Only a few seats remain available for this shift.",
        value: `${available} left`,
        severity: "medium",
      });
    }
  });

  /*
   * Keep the dashboard useful.
   *
   * We don't want a huge list taking over the page.
   */

  return items.slice(0, 5);
}

/* =========================================================
   ATTENTION SECTION
========================================================= */

function AttentionSection({ items }: { items: AttentionItem[] }) {
  const hasAttention = items.length > 0;

  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-stone-200
        bg-white
        shadow-sm
      "
    >
      <div
        className="
          flex
          flex-col
          gap-2
          border-b
          border-stone-100
          px-4
          py-4
          sm:flex-row
          sm:items-center
          sm:justify-between
          sm:px-5
        "
      >
        <div className="flex items-center gap-2">
          <div
            className={`
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              ${
                hasAttention
                  ? "bg-amber-50 text-amber-700"
                  : "bg-green-50 text-green-700"
              }
            `}
          >
            {hasAttention ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-stone-800">
              Attention Needed
            </h2>

            <p className="mt-0.5 text-xs text-stone-500">
              {hasAttention
                ? "Items that may require admin attention."
                : "No immediate operational issues detected."}
            </p>
          </div>
        </div>

        {hasAttention && (
          <span
            className="
              inline-flex
              w-fit
              items-center
              rounded-full
              border
              border-amber-200
              bg-amber-50
              px-2.5
              py-1
              text-[10px]
              font-medium
              text-amber-700
            "
          >
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {hasAttention ? (
        <div className="divide-y divide-stone-100">
          {items.map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-green-50
              text-green-600
            "
          >
            <CheckCircle2 size={18} />
          </div>

          <div>
            <p className="text-xs font-medium text-stone-700">
              Everything looks good
            </p>

            <p className="mt-0.5 text-[11px] text-stone-400">
              No immediate seat or operational issues need your attention.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   ATTENTION ROW
========================================================= */

function AttentionRow({ item }: { item: AttentionItem }) {
  const severityClasses = {
    high: {
      icon: "bg-red-50 text-red-700",
      badge: "border-red-200 bg-red-50 text-red-700",
    },

    medium: {
      icon: "bg-amber-50 text-amber-700",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
    },

    info: {
      icon: "bg-blue-50 text-blue-700",
      badge: "border-blue-200 bg-blue-50 text-blue-700",
    },
  };

  const classes = severityClasses[item.severity];

  return (
    <div
      className="
        flex
        items-center
        gap-3
        px-4
        py-3.5
        transition
        hover:bg-stone-50
        sm:px-5
      "
    >
      <div
        className={`
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-lg
          ${classes.icon}
        `}
      >
        {item.severity === "high" ? (
          <AlertTriangle size={16} />
        ) : (
          <CircleAlert size={16} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-stone-700">
          {item.title}
        </p>

        <p className="mt-0.5 text-[11px] leading-4 text-stone-400">
          {item.description}
        </p>
      </div>

      <span
        className={`
          shrink-0
          rounded-full
          border
          px-2.5
          py-1
          text-[10px]
          font-medium
          ${classes.badge}
        `}
      >
        {item.value}
      </span>
    </div>
  );
}

/* =========================================================
   SHIFT CARD
========================================================= */

function ShiftUtilizationCard({ shift }: { shift: DashboardShift }) {
  const occupied = toNumber(shift.occupiedSeats);

  const available = toNumber(shift.availableSeats);

  const total = occupied + available;

  const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const isCritical = percentage >= 90;

  const isHigh = percentage >= 80;

  return (
    <div
      className="
        rounded-xl
        border
        border-stone-200
        bg-stone-50/50
        p-4
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-stone-700">
            {shift.shiftName}
          </p>

          <p className="mt-0.5 text-[10px] text-stone-400">
            {total} total seats
          </p>
        </div>

        <span
          className={`
            shrink-0
            rounded-full
            border
            px-2
            py-1
            text-[9px]
            font-medium
            ${
              isCritical
                ? "border-red-200 bg-red-50 text-red-700"
                : isHigh
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-green-200 bg-green-50 text-green-700"
            }
          `}
        >
          {percentage}% full
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <span className="text-xl font-semibold text-stone-800">
            {occupied}
          </span>

          <span className="ml-1 text-[10px] text-stone-400">occupied</span>
        </div>

        <div className="text-right">
          <span className="text-sm font-semibold text-emerald-700">
            {available}
          </span>

          <span className="ml-1 text-[10px] text-stone-400">free</span>
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`
            h-full
            rounded-full
            transition-all
            ${isCritical ? "bg-red-500" : "bg-amber-600"}
          `}
          style={{
            width: `${Math.min(percentage, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN SNAPSHOT
========================================================= */

function AdminSnapshot({
  totalStudents,
  activeMemberships,
  availableSeats,
  monthlyRevenue,
}: {
  totalStudents: number;
  activeMemberships: number;
  availableSeats: number;
  monthlyRevenue: number;
}) {
  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-stone-200
        bg-white
        shadow-sm
      "
    >
      <div className="border-b border-stone-100 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <div
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              bg-stone-100
              text-stone-600
            "
          >
            <Layers size={16} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-stone-800">
              Admin Snapshot
            </h2>

            <p className="mt-0.5 text-xs text-stone-500">
              Quick operational indicators.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <SnapshotItem
          icon={Users}
          label="Students"
          value={totalStudents}
          description="registered"
          tone="blue"
        />

        <SnapshotItem
          icon={BadgeCheck}
          label="Memberships"
          value={activeMemberships}
          description="currently active"
          tone="green"
        />

        <SnapshotItem
          icon={Armchair}
          label="Seats"
          value={availableSeats}
          description="available today"
          tone={availableSeats > 0 ? "amber" : "red"}
        />

        <SnapshotItem
          icon={IndianRupee}
          label="Monthly revenue"
          value={`₹ ${formatNumber(monthlyRevenue)}`}
          description="received this month"
          tone="green"
        />
      </div>
    </section>
  );
}

/* =========================================================
   SNAPSHOT ITEM
========================================================= */

function SnapshotItem({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  description: string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-lg
          ${toneClasses[tone]}
        `}
      >
        <Icon size={15} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-stone-400">{label}</p>

        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-stone-800">
            {typeof value === "number" ? formatNumber(value) : value}
          </span>

          <span className="truncate text-[10px] text-stone-400">
            {description}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   REVENUE METRIC
========================================================= */

function RevenueMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div className="border-r border-stone-100 p-4 last:border-r-0 sm:p-5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>

      <p
        className={`
          mt-1.5
          truncate
          font-semibold
          ${emphasized ? "text-xl text-amber-700" : "text-lg text-stone-800"}
        `}
      >
        ₹ {formatNumber(value)}
      </p>
    </div>
  );
}

/* =========================================================
   REVENUE TREND INDICATOR
========================================================= */

function RevenueTrendIndicator({
  direction,
}: {
  direction: "up" | "down" | "neutral";
}) {
  if (direction === "up") {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1
          rounded-full
          border
          border-green-200
          bg-green-50
          px-2.5
          py-1
          text-[10px]
          font-medium
          text-green-700
        "
      >
        <ArrowUpRight size={12} />
        Rising
      </span>
    );
  }

  if (direction === "down") {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1
          rounded-full
          border
          border-red-200
          bg-red-50
          px-2.5
          py-1
          text-[10px]
          font-medium
          text-red-700
        "
      >
        <ArrowDownRight size={12} />
        Falling
      </span>
    );
  }

  return (
    <span
      className="
        inline-flex
        items-center
        gap-1
        rounded-full
        border
        border-stone-200
        bg-stone-50
        px-2.5
        py-1
        text-[10px]
        font-medium
        text-stone-500
      "
    >
      <Clock3 size={11} />
      Stable
    </span>
  );
}

/* =========================================================
   EMPTY SHIFT STATE
========================================================= */

function EmptyShiftState() {
  return (
    <div
      className="
        col-span-full
        rounded-xl
        border
        border-dashed
        border-stone-200
        bg-stone-50
        px-5
        py-8
        text-center
      "
    >
      <Armchair size={22} className="mx-auto text-stone-400" />

      <p className="mt-2 text-xs font-medium text-stone-600">
        No shift data available
      </p>

      <p className="mt-1 text-[11px] text-stone-400">
        Seat utilization will appear here once shifts are configured.
      </p>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass,
  accentClass,
  highlight = false,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  iconClass: string;
  accentClass: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`
        relative
        overflow-hidden
        rounded-2xl
        border
        bg-white
        p-4
        shadow-sm
        transition
        hover:-translate-y-0.5
        hover:shadow-md
        sm:p-5
        ${highlight ? "border-amber-200" : "border-stone-200"}
      `}
    >
      <div
        className={`
          absolute
          left-0
          top-0
          h-full
          w-1
          ${accentClass}
        `}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500">{title}</p>

          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-800">
            {formatNumber(value)}
          </p>

          <p className="mt-1 text-[11px] text-stone-400">{subtitle}</p>
        </div>

        <div
          className={`
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            ${iconClass}
          `}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ERROR STATE
========================================================= */

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-full bg-stone-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl">
        <div
          className="
            rounded-2xl
            border
            border-red-200
            bg-red-50
            p-5
            sm:p-6
          "
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-red-100
                  text-red-600
                "
              >
                <CircleAlert size={18} />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-red-800">
                  Dashboard unavailable
                </h2>

                <p className="mt-1 text-xs text-red-600">
                  We couldn't load the latest dashboard information.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRetry}
              className="
                w-fit
                rounded-lg
                border
                border-red-200
                bg-white
                px-4
                py-2
                text-xs
                font-medium
                text-red-700
                transition
                hover:bg-red-50
              "
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING SKELETON
========================================================= */

function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-stone-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="space-y-2">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-stone-200" />

          <div className="h-4 w-72 animate-pulse rounded bg-stone-200" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="
                h-28
                animate-pulse
                rounded-2xl
                border
                border-stone-200
                bg-white
              "
            />
          ))}
        </div>

        <div
          className="
            h-60
            animate-pulse
            rounded-2xl
            border
            border-stone-200
            bg-white
          "
        />

        <div
          className="
            h-48
            animate-pulse
            rounded-2xl
            border
            border-stone-200
            bg-white
          "
        />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div
            className="
              h-40
              animate-pulse
              rounded-2xl
              border
              border-stone-200
              bg-white
            "
          />

          <div
            className="
              h-40
              animate-pulse
              rounded-2xl
              border
              border-stone-200
              bg-white
            "
          />
        </div>

        <div
          className="
            h-[350px]
            animate-pulse
            rounded-2xl
            border
            border-stone-200
            bg-white
          "
        />
      </div>
    </div>
  );
}

/* =========================================================
   REVENUE TREND
========================================================= */

function getRevenueTrendDirection(
  trend: RevenueTrendItem[],
): "up" | "down" | "neutral" {
  if (!Array.isArray(trend) || trend.length < 2) {
    return "neutral";
  }

  const sorted = [...trend]
    .filter((item) => item?.date && Number.isFinite(Number(item?.amount)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 2) {
    return "neutral";
  }

  const midpoint = Math.floor(sorted.length / 2);

  const firstHalf = sorted.slice(0, midpoint);

  const secondHalf = sorted.slice(midpoint);

  const firstTotal = firstHalf.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0,
  );

  const secondTotal = secondHalf.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0,
  );

  if (secondTotal > firstTotal) {
    return "up";
  }

  if (secondTotal < firstTotal) {
    return "down";
  }

  return "neutral";
}

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | undefined | null): string {
  return toNumber(value).toLocaleString("en-IN");
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
