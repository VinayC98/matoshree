type Props = {
  allocationMode?: boolean;
};

export default function SeatLegend({ allocationMode = false }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-5 text-[10px] text-stone-500 sm:text-xs">
      <Legend color="bg-emerald-600" label="Available" />

      <Legend color="bg-amber-600" label="Occupied" />

      <Legend color="bg-stone-500" label="Fixed Seat" />

      {allocationMode && (
        <span className="ml-auto hidden text-[10px] text-stone-400 sm:inline">
          Click an available seat to assign
        </span>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded ${color}`} />

      <span>{label}</span>
    </div>
  );
}
