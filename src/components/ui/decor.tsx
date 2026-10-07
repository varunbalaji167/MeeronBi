/** Shared decorative SVG backgrounds — used across the landing, trends, and auth-shell pages. */

/* ──────────────────────── Organic / Bloom motifs ──────────────────────── */

/** Concentric growth rings — evokes tree rings and ultrasound cross-sections. */
export function GrowthRings({
  className = "",
  color = "rgb(var(--brand-500) / 0.08)",
  cx = 50,
  cy = 50,
  rings = 5,
}: {
  className?: string;
  color?: string;
  cx?: number;
  cy?: number;
  rings?: number;
}) {
  const radii = Array.from({ length: rings }, (_, i) => 14 + i * 12);
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className} fill="none">
      {radii.map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r} stroke={color} strokeWidth="0.7" />
      ))}
    </svg>
  );
}

/** Layered gentle waves — multiple soft sine curves with optional fill for richer backgrounds. */
export function GentleWave({
  className = "",
  stroke = "currentColor",
  strokeWidth = 1.2,
  fill = false,
}: {
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: boolean;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 80" preserveAspectRatio="none" className={className} fill="none">
      {fill && (
        <path
          d="M0,50 C200,30 350,65 500,45 C700,25 850,60 1050,45 C1150,35 1200,50 1200,48 L1200,80 L0,80 Z"
          fill={stroke}
          opacity="0.06"
        />
      )}
      <path
        d="M0,35 C150,15 300,55 450,35 C600,15 750,55 900,35 C1050,15 1200,55 1200,35"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="animate-wave-drift"
      />
      <path
        d="M0,50 C200,30 350,65 500,45 C700,25 850,60 1050,45 C1150,35 1200,50 1200,48"
        stroke={stroke}
        strokeWidth={strokeWidth * 0.7}
        strokeLinecap="round"
        opacity="0.4"
        className="animate-wave-drift [animation-delay:1.5s]"
      />
      <path
        d="M0,22 C180,38 350,8 550,25 C750,42 900,12 1100,28 C1160,32 1200,24 1200,24"
        stroke={stroke}
        strokeWidth={strokeWidth * 0.4}
        strokeLinecap="round"
        opacity="0.2"
        className="animate-wave-drift [animation-delay:3s]"
      />
    </svg>
  );
}

/** Tiled leaf-vein pattern — a softer alternative to the medical cross grid. */
export function LeafPattern({
  className = "",
  color = "rgb(var(--brand-500) / 0.06)",
  patternId = "leaf",
}: {
  className?: string;
  color?: string;
  patternId?: string;
}) {
  return (
    <svg aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={patternId} x="0" y="0" width="52" height="52" patternUnits="userSpaceOnUse">
          <path
            d="M26,8 Q32,18 26,28 Q20,18 26,8 Z"
            fill="none"
            stroke={color}
            strokeWidth="0.8"
          />
          <path
            d="M26,14 L26,26"
            stroke={color}
            strokeWidth="0.5"
          />
          <circle cx="8" cy="44" r="1" fill={color} />
          <circle cx="44" cy="44" r="1" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

/* ──────────────────────── Legacy motifs (kept for login page) ──────────────────────── */

export function EcgLine({ className = "", stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 80" preserveAspectRatio="none" className={className} fill="none">
      <path
        d="M0,40 L180,40 L200,40 L215,20 L230,60 L245,10 L260,70 L275,40 L420,40 L440,40 L455,25 L470,55 L485,15 L500,65 L515,40 L720,40 L740,40 L755,20 L770,60 L785,10 L800,70 L815,40 L1020,40 L1040,40 L1055,25 L1070,55 L1085,15 L1100,65 L1115,40 L1200,40"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-ecg"
      />
    </svg>
  );
}

export function DotGrid({
  className = "",
  color = "rgba(0,0,0,0.5)",
  size = 22,
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${color} 1px, transparent 0)`, backgroundSize: `${size}px ${size}px` }}
    />
  );
}

const BLOB_RADIUS = "38% 62% 63% 37% / 41% 44% 56% 59%";

const flatTones: Record<"brand" | "gold" | "rose" | "ink-on-dark", { border: string; fill: string }> = {
  brand: { border: "border-brand-200", fill: "bg-brand-50/80" },
  gold: { border: "border-gold-300/70", fill: "bg-gold-50/80" },
  rose: { border: "border-rose-200", fill: "bg-rose-50/80" },
  "ink-on-dark": { border: "border-white/25", fill: "bg-white/5" },
};

export function FlatShape({
  className = "",
  tone = "brand",
  rotate = 0,
}: {
  className?: string;
  tone?: "brand" | "gold" | "rose" | "ink-on-dark";
  rotate?: number;
}) {
  const t = flatTones[tone];
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none border ${t.border} ${t.fill} ${className}`}
      style={{ borderRadius: BLOB_RADIUS, transform: `rotate(${rotate}deg)` }}
    />
  );
}

export function FlatShapePair({
  className = "",
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "gold" | "rose" | "ink-on-dark";
}) {
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <FlatShape tone={tone} rotate={-8} className="absolute -left-12 top-4 h-40 w-40 animate-float-slow" />
      <FlatShape tone={tone} rotate={14} className="absolute -right-8 bottom-2 h-48 w-48 animate-float-slow [animation-delay:1.2s]" />
    </div>
  );
}

export function MedicalCrossPattern({
  className = "",
  color = "rgb(var(--brand-500) / 0.08)",
  patternId = "mcross",
}: {
  className?: string;
  color?: string;
  patternId?: string;
}) {
  return (
    <svg aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={patternId} x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24,16 L24,32 M16,24 L32,24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="4" cy="4" r="1" fill={color} />
          <circle cx="44" cy="44" r="1" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
