export default function Spinner({ className = "h-4 w-4", light }: { className?: string; light?: boolean }) {
  return (
    <svg
      className={`animate-spin ${className} ${light ? "text-white" : "text-brand-500"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}
