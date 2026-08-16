import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, TrendingUp } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

type TrendItem = {
  date: string;
  amount: number;
};

type Props = {
  trend: TrendItem[];
};

type ViewMode = "day" | "week" | "month" | "year";

export default function RevenueChart({ trend }: Props) {
  const [view, setView] = useState<ViewMode>("day");

  /* =========================================================
     NORMALIZE
  ========================================================= */

  const filtered = useMemo(() => {
    const sixMonthsAgo = new Date();

    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return trend
      .map((item) => ({
        date: new Date(item.date),
        amount: Number(item.amount ?? 0),
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.date.getTime()) && item.date >= sixMonthsAgo,
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [trend]);

  /* =========================================================
     GROUP
  ========================================================= */

  const grouped = useMemo(() => {
    const map = new Map<string, number>();

    filtered.forEach(({ date, amount }) => {
      let key = "";

      switch (view) {
        case "day":
          key = date.toISOString().split("T")[0];
          break;

        case "week": {
          const firstDay = new Date(date);

          firstDay.setDate(date.getDate() - date.getDay());

          key = firstDay.toISOString().split("T")[0];

          break;
        }

        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0",
          )}`;
          break;

        case "year":
          key = String(date.getFullYear());
          break;
      }

      map.set(key, (map.get(key) ?? 0) + amount);
    });

    return Array.from(map.entries()).map(([label, amount]) => ({
      label,
      amount,
    }));
  }, [filtered, view]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const totalRevenue = grouped.reduce((sum, item) => sum + item.amount, 0);

  const averageRevenue = grouped.length > 0 ? totalRevenue / grouped.length : 0;

  /* =========================================================
     CHART
  ========================================================= */

  const chartData = {
    labels: grouped.map((item) => formatChartLabel(item.label, view)),

    datasets: [
      {
        label: "Revenue",
        data: grouped.map((item) => item.amount),

        borderColor: "#92400E",
        backgroundColor: "rgba(146,64,14,0.12)",

        fill: true,
        tension: 0.35,

        spanGaps: true,
        borderWidth: 2.5,

        pointRadius: grouped.length > 20 ? 2 : 4,

        pointHoverRadius: 6,

        pointBackgroundColor: "#78350F",
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,

    maintainAspectRatio: false,

    interaction: {
      intersect: false,
      mode: "index",
    },

    plugins: {
      legend: {
        display: false,
      },

      tooltip: {
        displayColors: false,

        callbacks: {
          title: (items: TooltipItem<"line">[]) => items[0]?.label ?? "",

          label: (context: TooltipItem<"line">) =>
            `₹ ${Number(context.parsed.y ?? 0).toLocaleString("en-IN")}`,
        },
      },
    },

    scales: {
      x: {
        ticks: {
          color: "#78716C",

          maxTicksLimit: view === "day" ? 10 : 8,

          font: {
            size: 10,
          },
        },

        grid: {
          display: false,
        },

        border: {
          display: false,
        },
      },

      y: {
        beginAtZero: true,

        ticks: {
          color: "#78716C",

          font: {
            size: 10,
          },

          callback: (value) => `₹ ${Number(value).toLocaleString("en-IN")}`,
        },

        grid: {
          color: "rgba(120,113,108,0.10)",
        },

        border: {
          display: false,
        },
      },
    },
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* HEADER */}

      <div className="border-b border-stone-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <TrendingUp size={16} />
              </div>

              <h2 className="text-sm font-semibold text-stone-800">
                Revenue Trend
              </h2>
            </div>

            <p className="mt-1 text-xs text-stone-500">
              Revenue received over time.
            </p>
          </div>

          {/* RANGE */}

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 text-[10px] text-stone-400 sm:flex">
              <CalendarDays size={12} />
              Last 6 months
            </div>

            <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
              {(["day", "week", "month", "year"] as ViewMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={`
                    rounded-md
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-medium
                    transition
                    ${
                      view === value
                        ? "bg-amber-700 text-white shadow-sm"
                        : "text-stone-500 hover:bg-stone-200 hover:text-stone-700"
                    }
                  `}
                >
                  {value === "day"
                    ? "Day"
                    : value === "week"
                      ? "Week"
                      : value === "month"
                        ? "Month"
                        : "Year"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-2 divide-x divide-stone-100 border-b border-stone-100 sm:grid-cols-3">
        <ChartSummary label="Period Revenue" value={totalRevenue} />

        <ChartSummary label="Average" value={averageRevenue} />

        <div className="hidden sm:block">
          <ChartSummary
            label="Data Points"
            value={grouped.length}
            isCurrency={false}
          />
        </div>
      </div>

      {/* CHART */}

      <div className="p-4 sm:p-5">
        {grouped.length < 2 ? (
          <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/60 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <BarChart3 size={18} />
            </div>

            <p className="mt-3 text-xs font-medium text-stone-600">
              Not enough revenue data
            </p>

            <p className="mt-1 max-w-xs text-[10px] leading-5 text-stone-400">
              More payment history is required to display a meaningful trend.
            </p>
          </div>
        ) : (
          <div className="h-[280px]">
            <Line data={chartData} options={options} />
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   CHART SUMMARY
========================================================= */

function ChartSummary({
  label,
  value,
  isCurrency = true,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  return (
    <div className="p-4 sm:p-5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-stone-800">
        {isCurrency
          ? `₹ ${Number(value ?? 0).toLocaleString("en-IN")}`
          : Number(value ?? 0).toLocaleString("en-IN")}
      </p>
    </div>
  );
}

/* =========================================================
   LABEL FORMAT
========================================================= */

function formatChartLabel(value: string, view: ViewMode) {
  if (view === "year") {
    return value;
  }

  if (view === "month") {
    const [year, month] = value.split("-");

    const date = new Date(Number(year), Number(month) - 1, 1);

    return date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}
