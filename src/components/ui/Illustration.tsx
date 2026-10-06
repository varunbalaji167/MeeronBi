export type IllustrationName = "patients" | "entries" | "results" | "notFound";

// Inline SVG on palette classes only (no raster assets); decorative, so always hidden from assistive tech.
const DRAWINGS: Record<IllustrationName, React.ReactNode> = {
  patients: (
    <>
      <ellipse cx="80" cy="104" rx="46" ry="6" className="fill-brand-50" />
      <rect x="40" y="16" width="64" height="84" rx="8" className="fill-white stroke-brand-300" strokeWidth="2" />
      <rect x="62" y="10" width="20" height="12" rx="4" className="fill-brand-100 stroke-brand-300" strokeWidth="2" />
      <circle cx="58" cy="44" r="7" className="fill-brand-100" />
      <rect x="70" y="40" width="26" height="4" rx="2" className="fill-brand-100" />
      <rect x="70" y="48" width="16" height="4" rx="2" className="fill-brand-50" />
      <rect x="50" y="68" width="46" height="4" rx="2" className="fill-brand-50" />
      <rect x="50" y="78" width="34" height="4" rx="2" className="fill-brand-50" />
      <circle cx="108" cy="82" r="14" className="fill-gold-50 stroke-gold-500" strokeWidth="2" />
      <path d="M108 75v14M101 82h14" className="stroke-gold-600" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  entries: (
    <>
      <ellipse cx="80" cy="104" rx="50" ry="6" className="fill-brand-50" />
      <rect x="24" y="22" width="112" height="74" rx="8" className="fill-white stroke-brand-300" strokeWidth="2" />
      <rect x="24" y="22" width="112" height="18" rx="8" className="fill-brand-50" />
      <path d="M24 40h112M60 22v74M98 22v74" className="stroke-brand-200" strokeWidth="1.5" />
      <rect x="32" y="29" width="20" height="4" rx="2" className="fill-brand-300" />
      <rect x="68" y="29" width="22" height="4" rx="2" className="fill-brand-300" />
      <rect x="106" y="29" width="20" height="4" rx="2" className="fill-brand-300" />
      <rect x="32" y="52" width="96" height="14" rx="4" className="fill-none stroke-brand-300" strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="32" y="74" width="96" height="14" rx="4" className="fill-none stroke-brand-100" strokeWidth="1.5" strokeDasharray="4 4" />
    </>
  ),
  results: (
    <>
      <ellipse cx="80" cy="104" rx="46" ry="6" className="fill-brand-50" />
      <rect x="34" y="20" width="64" height="76" rx="8" className="fill-white stroke-brand-200" strokeWidth="2" />
      <rect x="44" y="32" width="36" height="4" rx="2" className="fill-brand-100" />
      <rect x="44" y="42" width="44" height="4" rx="2" className="fill-brand-50" />
      <rect x="44" y="52" width="28" height="4" rx="2" className="fill-brand-50" />
      <circle cx="98" cy="68" r="22" className="fill-white/80 stroke-brand-500" strokeWidth="3" />
      <path d="M114 84l16 16" className="stroke-brand-500" strokeWidth="5" strokeLinecap="round" />
      <path d="M90 62l16 12M106 62L90 74" className="stroke-gold-500" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  notFound: (
    <>
      <ellipse cx="80" cy="106" rx="48" ry="6" className="fill-brand-50" />
      <path d="M44 14h46l24 24v62a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" className="fill-white stroke-brand-300" strokeWidth="2" />
      <path d="M90 14v18a6 6 0 0 0 6 6h18" className="fill-brand-50 stroke-brand-300" strokeWidth="2" strokeLinejoin="round" />
      <path d="M64 62c0-7 5-11 12-11s12 4 12 10c0 7-7 8-10 12-1 2-2 3-2 6" className="fill-none stroke-brand-500" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="76" cy="90" r="2.8" className="fill-gold-500" />
    </>
  ),
};

export default function Illustration({ name, className = "h-28 w-auto" }: { name: IllustrationName; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" aria-hidden="true" focusable="false" data-illustration={name}>
      {DRAWINGS[name]}
    </svg>
  );
}
