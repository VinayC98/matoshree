import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getStudentDetails } from "../api/students.api";

type Tab = "overview" | "memberships" | "payments" | "seats";

export default function StudentDetails() {
  const { id } = useParams();
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["student-details", id],
    queryFn: () => getStudentDetails(id!),
    enabled: !!id,
  });

  if (isLoading) return <p>Loading student details...</p>;

  const { student, memberships, payments, allocations } = data;

  return (
    <div className="flex gap-6">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-lg">{student.name}</h2>
        <p className="text-sm text-gray-500">{student.mobile}</p>

        <nav className="pt-4 space-y-1">
          <NavItem
            label="Overview"
            active={tab === "overview"}
            onClick={() => setTab("overview")}
          />
          <NavItem
            label="Memberships"
            active={tab === "memberships"}
            onClick={() => setTab("memberships")}
          />
          <NavItem
            label="Payments"
            active={tab === "payments"}
            onClick={() => setTab("payments")}
          />
          <NavItem
            label="Seat History"
            active={tab === "seats"}
            onClick={() => setTab("seats")}
          />
        </nav>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 bg-white border rounded-lg p-6">
        {tab === "overview" && (
          <Overview student={student} memberships={memberships} />
        )}

        {tab === "memberships" && <MembershipTable memberships={memberships} />}

        {tab === "payments" && <PaymentsTable payments={payments} />}

        {tab === "seats" && <SeatHistoryTable allocations={allocations} />}
      </main>
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function NavItem({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded ${
        active ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}

function Overview({ student, memberships }: any) {
  const active = memberships.find((m: any) => m.isActive);

  if (!active) {
    return <p className="text-gray-500">No active membership</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Overview</h3>

      <div className="border rounded p-4 bg-gray-50 space-y-1">
        <p>
          <strong>Plan:</strong> {active.membershipPlan?.name ?? "—"}
        </p>

        <p>
          <strong>Shift:</strong> {active.shift?.name ?? "—"}
        </p>

        <p>
          <strong>Duration:</strong> {new Date(active.startDate).toDateString()}{" "}
          → {new Date(active.endDate).toDateString()}
        </p>

        {active.fixedSeat && (
          <p>
            <strong>Fixed Seat:</strong> {active.fixedSeat.lab?.name} – Seat{" "}
            {active.fixedSeat.seatNumber}
          </p>
        )}
      </div>
    </div>
  );
}

function MembershipTable({ memberships }: any) {
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2">Plan</th>
          <th className="p-2">Shift</th>
          <th className="p-2">Start</th>
          <th className="p-2">End</th>
          <th className="p-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {memberships.map((m: any) => (
          <tr key={m.id} className="border-t">
            <td className="p-2">{m.membershipPlan.name}</td>
            <td className="p-2">{m.shift.name}</td>
            <td className="p-2">{new Date(m.startDate).toDateString()}</td>
            <td className="p-2">{new Date(m.endDate).toDateString()}</td>
            <td className="p-2">{m.isActive ? "Active" : "Expired"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentsTable({ payments }: any) {
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2">Amount</th>
          <th className="p-2">Type</th>
          <th className="p-2">Date</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p: any) => (
          <tr key={p.id} className="border-t">
            <td className="p-2">₹{p.amount}</td>
            <td className="p-2">{p.paymentType}</td>
            <td className="p-2">{new Date(p.paidOn).toDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SeatHistoryTable({ allocations }: any) {
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2">Date</th>
          <th className="p-2">Shift</th>
          <th className="p-2">Seat</th>
        </tr>
      </thead>
      <tbody>
        {allocations.map((a: any) => (
          <tr key={a.id} className="border-t">
            <td className="p-2">{new Date(a.date).toDateString()}</td>
            <td className="p-2">{a.shift.name}</td>
            <td className="p-2">
              {a.seat.lab.name} – Seat {a.seat.seatNumber}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
