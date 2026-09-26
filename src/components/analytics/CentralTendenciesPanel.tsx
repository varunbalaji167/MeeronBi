import { Hash, TrendingUp, ArrowDown, ArrowUp, Repeat, Waves, type LucideIcon } from "lucide-react";
import { CentralTendencies } from "@/domain/analytics/types";

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

interface Tile {
  label: string;
  value: string;
  icon: LucideIcon;
}

/** Compact stat tiles for a ratio field's central tendencies. Renders exactly what the API returns — no client-side recomputation. */
export default function CentralTendenciesPanel({ stats, unit }: { stats: CentralTendencies; unit?: string }) {
  const suffix = unit ? ` ${unit}` : "";
  const tiles: Tile[] = [
    { label: "Count", value: String(stats.count), icon: Hash },
    { label: "Average", value: `${formatNumber(stats.average)}${suffix}`, icon: TrendingUp },
    { label: "Min", value: `${formatNumber(stats.min)}${suffix}`, icon: ArrowDown },
    { label: "Max", value: `${formatNumber(stats.max)}${suffix}`, icon: ArrowUp },
    { label: "Mode", value: stats.mode === null ? "—" : `${formatNumber(stats.mode)}${suffix}`, icon: Repeat },
    { label: "Std. Deviation", value: formatNumber(stats.standardDeviation), icon: Waves },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="panel border-l-2 border-brand-300 py-3 transition-transform hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            <tile.icon className="h-3 w-3 text-brand-400" /> {tile.label}
          </p>
          <p className="mt-1 font-display text-xl italic text-ink">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
