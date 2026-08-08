import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useMemo, useState } from "react";

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

  /* -----------------------------
     NORMALIZE + FILTER (6 MONTHS)
  ----------------------------- */
  const filtered = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return trend
      .map((t) => ({
        date: new Date(t.date),
        amount: t.amount,
      }))
      .filter((t) => t.date >= sixMonthsAgo)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [trend]);

  /* -----------------------------
     GROUP DATA
  ----------------------------- */
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

  /* -----------------------------
     CHART DATA
  ----------------------------- */
  const chartData = {
    labels: grouped.map((g) => g.label),
    datasets: [
      {
        label: "Revenue (₹)",
        data: grouped.map((g) => g.amount),

        borderColor: "#92400E",
        backgroundColor: "rgba(146,64,14,0.18)",

        fill: true,
        tension: 0.35,

        showLine: true,
        spanGaps: true,
        borderWidth: 3,

        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#78350F",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: "#444",
          font: { weight: "600" },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `₹ ${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#555" },
        grid: { display: false },
      },
      y: {
        ticks: {
          callback: (v: any) => `₹ ${v}`,
          color: "#555",
        },
        grid: {
          color: "rgba(0,0,0,0.05)",
        },
      },
    },
  };

  /* -----------------------------
     RENDER
  ----------------------------- */
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Revenue Trend</h2>

        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          {(["day", "week", "month", "year"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-sm rounded-md transition ${
                view === v
                  ? "bg-amber-700 text-white"
                  : "text-stone-600 hover:bg-stone-200"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Empty / Low data state */}
      {grouped.length < 2 && (
        <p className="text-xs text-stone-500">
          Not enough data yet to show a trend line
        </p>
      )}

      {/* Chart */}
      <div className="h-[280px]">
        <Line data={chartData} />
      </div>
    </div>
  );
}
