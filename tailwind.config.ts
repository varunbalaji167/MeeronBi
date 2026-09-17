import type { Config } from "tailwindcss";

const config: Config = {
  // A single catch-all glob rather than listing each top-level folder:
  // src/context/ToastContext.tsx (and other non-component-folder files)
  // were previously missed here after a restructure added new directories
  // (domain/, server/, context/, hooks/) — any Tailwind classes used in an
  // unscanned file are silently dropped from the compiled CSS, which is
  // exactly what made toast notifications invisible (the div rendered with
  // zero styling: no `fixed`, no z-index, nothing). Scanning everything
  // under src/ means a new folder can never silently fall out of coverage
  // again.
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Warm paper background + deep forest-ink text — a clinical palette
        // grounded in maternal/antenatal care rather than generic SaaS blue.
        ink: {
          DEFAULT: "#1B2420",
          soft: "#3F473F",
          faint: "#6B7268",
        },
        paper: {
          DEFAULT: "#F6F6F2",
          raised: "#FFFFFF",
        },
        line: {
          DEFAULT: "#E1E0D5",
          soft: "#ECEBE1",
        },
        // Primary: deep clinical teal
        brand: {
          50: "#E9F3F0",
          100: "#D3E7E1",
          200: "#A6CFC2",
          300: "#79B7A4",
          400: "#3D8E77",
          500: "#0E6B5C",
          600: "#0A5347",
          700: "#083F37",
          800: "#062C27",
        },
        // Draft / attention
        gold: {
          50: "#FBF1DD",
          200: "#EBC97A",
          500: "#B8862E",
          600: "#8F6820",
        },
        // Danger / delete
        rose: {
          50: "#FBEAE9",
          200: "#E7A8A4",
          500: "#A3423D",
          600: "#812F2B",
        },
      },
      boxShadow: {
        panel: "0 1px 2px rgba(27, 36, 32, 0.04), 0 1px 1px rgba(27, 36, 32, 0.03)",
      },
      borderRadius: {
        md: "0.5rem",
        lg: "0.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
