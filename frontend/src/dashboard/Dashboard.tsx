// import { useQuery } from "@tanstack/react-query";
// import { getDashboard } from "../api/dashboard.api";
// import RevenueChart from "./components/RevenueChart";

// /* =======================
//    COMPONENT
// ======================= */

// export default function Dashboard() {
//   const { data, isLoading, isError } = useQuery({
//     queryKey: ["dashboard"],
//     queryFn: getDashboard,
//   });

//   if (isLoading) {
//     return <p>Loading dashboard...</p>;
//   }

//   if (isError || !data) {
//     return <p className="text-red-600">Failed to load dashboard</p>;
//   }

//   /**
//    * ✅ SAFE AVAILABLE SEATS TODAY
//    * Definition:
//    * Minimum availability across all shifts
//    */
//   const availableSeatsToday =
//     data.seatUtilization.byShift.length > 0
//       ? Math.min(
//           ...data.seatUtilization.byShift.map(
//             (shift: any) => shift.availableSeats
//           )
//         )
//       : 0;

//   return (
//     <div className="space-y-8">
//       <h1 className="text-2xl font-semibold">Dashboard</h1>

//       {/* =======================
//           SUMMARY CARDS
//       ======================= */}
//       <div className="grid grid-cols-4 gap-4">
//         <SummaryCard
//           title="Total Students"
//           value={data.summary.totalStudents}
//         />

//         <SummaryCard title="Fixed Seats" value={data.summary.fixedSeats} />

//         <SummaryCard
//           title="Active Memberships"
//           value={data.summary.activeMemberships}
//         />

//         <SummaryCard title="Total Seats" value={data.summary.totalSeats} />

//         <SummaryCard
//           title="Available Seats Today"
//           value={availableSeatsToday}
//         />
//       </div>

//       {/* =======================
//           SEAT UTILIZATION
//       ======================= */}
//       <div className="bg-white rounded-lg shadow-sm p-4">
//         <h2 className="font-semibold mb-4">Seat Utilization by Shift</h2>

//         <div className="space-y-3">
//           {data.seatUtilization.byShift.map((shift: any) => {
//             const total = shift.occupiedSeats + shift.availableSeats;

//             const percent = total > 0 ? (shift.occupiedSeats / total) * 100 : 0;

//             return (
//               <div key={shift.shiftId}>
//                 <div className="flex justify-between text-sm">
//                   <span>{shift.shiftName}</span>
//                   <span>
//                     {shift.occupiedSeats} / {total}
//                   </span>
//                 </div>

//                 <div className="h-2 bg-gray-200 rounded mt-1">
//                   <div
//                     className="h-2 bg-blue-800 rounded"
//                     style={{ width: `${percent}%` }}
//                   />
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* =======================
//           REVENUE
//       ======================= */}
//       <div className="bg-white rounded-lg shadow-sm p-4">
//         <h2 className="font-semibold mb-4">Revenue</h2>

//         <p className="text-xs text-gray-500 mb-4">
//           Revenue reflects payments actually received.
//         </p>

//         <div className="flex gap-8">
//           <div>
//             <p className="text-sm text-gray-500">Today</p>
//             <p className="text-xl font-semibold">₹ {data.revenue.today}</p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-500">This Month</p>
//             <p className="text-xl font-semibold">₹ {data.revenue.month}</p>
//           </div>
//         </div>
//       </div>

//       {/* =======================
//           REVENUE TREND
//       ======================= */}
//       <RevenueChart trend={data.revenue.trend} />
//     </div>
//   );
// }

// /* =======================
//    REUSABLE CARD
// ======================= */
// function SummaryCard({ title, value }: { title: string; value: number }) {
//   return (
//     <div className="bg-white rounded-lg shadow-sm p-4">
//       <p className="text-sm text-gray-500">{title}</p>
//       <p className="text-2xl font-semibold mt-2">{value}</p>
//     </div>
//   );
// }

import { useQuery } from "@tanstack/react-query";
import { Users, Armchair, BadgeCheck, Layers, IndianRupee } from "lucide-react";
import { getDashboard } from "../api/dashboard.api";
import RevenueChart from "./components/RevenueChart";

/* =======================
   COMPONENT
======================= */

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  if (isLoading) return <p>Loading dashboard...</p>;
  if (isError || !data)
    return <p className="text-red-600">Failed to load dashboard</p>;

  const availableSeatsToday =
    data.seatUtilization.byShift.length > 0
      ? Math.min(
          ...data.seatUtilization.byShift.map(
            (shift: any) => shift.availableSeats,
          ),
        )
      : 0;

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-stone-800">
        Dashboard Overview
      </h1>

      {/* =======================
          SUMMARY CARDS
      ======================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <SummaryCard
          title="Total Students"
          value={data.summary.totalStudents}
          icon={Users}
        />

        <SummaryCard
          title="Fixed Seats"
          value={data.summary.fixedSeats}
          icon={Armchair}
        />

        <SummaryCard
          title="Active Memberships"
          value={data.summary.activeMemberships}
          icon={BadgeCheck}
        />

        <SummaryCard
          title="Total Seats"
          value={data.summary.totalSeats}
          icon={Layers}
        />

        <SummaryCard
          title="Available Today"
          value={availableSeatsToday}
          icon={Armchair}
          highlight
        />
      </div>

      {/* =======================
          SEAT UTILIZATION
      ======================= */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="font-semibold text-stone-800 mb-4">
          Seat Utilization by Shift
        </h2>

        <div className="space-y-4">
          {data.seatUtilization.byShift.map((shift: any) => {
            const total = shift.occupiedSeats + shift.availableSeats;
            const percent = total > 0 ? (shift.occupiedSeats / total) * 100 : 0;

            return (
              <div key={shift.shiftId}>
                <div className="flex justify-between text-sm text-stone-600">
                  <span>{shift.shiftName}</span>
                  <span>
                    {shift.occupiedSeats} / {total}
                  </span>
                </div>

                <div className="h-2 bg-stone-200 rounded mt-1 overflow-hidden">
                  <div
                    className="h-2 bg-amber-600 rounded transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =======================
          REVENUE
      ======================= */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <IndianRupee className="text-amber-700" size={20} />
          <h2 className="font-semibold text-stone-800">Revenue</h2>
        </div>

        <p className="text-xs text-stone-500 mb-4">
          Reflects payments actually received.
        </p>

        <div className="flex gap-10">
          <div>
            <p className="text-sm text-stone-500">Today</p>
            <p className="text-xl font-semibold text-stone-800">
              ₹ {data.revenue.today}
            </p>
          </div>

          <div>
            <p className="text-sm text-stone-500">This Month</p>
            <p className="text-xl font-semibold text-stone-800">
              ₹ {data.revenue.month}
            </p>
          </div>
        </div>
      </section>

      {/* =======================
          REVENUE TREND
      ======================= */}
      <RevenueChart trend={data.revenue.trend} />
    </div>
  );
}

/* =======================
   SUMMARY CARD
======================= */
function SummaryCard({
  title,
  value,
  icon: Icon,
  highlight = false,
}: {
  title: string;
  value: number;
  icon: any;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative bg-white rounded-xl border p-5
      ${highlight ? "border-amber-400" : "border-stone-200"}`}
    >
      {/* Accent Strip */}
      <div
        className={`absolute left-0 top-0 h-full w-1 rounded-l-xl
        ${highlight ? "bg-amber-500" : "bg-stone-300"}`}
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">{title}</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{value}</p>
        </div>

        <div
          className={`p-2 rounded-lg
          ${highlight ? "bg-amber-100" : "bg-stone-100"}`}
        >
          <Icon size={22} className="text-stone-700" />
        </div>
      </div>
    </div>
  );
}
