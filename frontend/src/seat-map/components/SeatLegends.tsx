export default function SeatLegend() {
  return (
    <div className="flex gap-6 text-sm text-stone-700">
      <Legend color="bg-emerald-600" label="Free" />
      <Legend color="bg-amber-600" label="Occupied" />
      <Legend color="bg-stone-500" label="Fixed Seat" />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded ${color}`} />
      {label}
    </div>
  );
}
