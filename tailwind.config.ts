import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
// Relative on purpose: this file is loaded through jiti, which ignores tsconfig paths.
import { hexToRgbChannels } from "./src/lib/design/color";
import { palette } from "./src/lib/design/palette";

type Tree = { [k: string]: string | Tree };
type ColorTree = { [k: string]: string | ColorTree };

// "ink" + DEFAULT -> "--ink"; "brand" + 500 -> "--brand-500".
const varName = (path: string[]) => "--" + path.filter((k) => k !== "DEFAULT").join("-");

function mapLeaves(node: Tree, path: string[], leaf: (path: string[], hex: string) => string): ColorTree {
  return Object.fromEntries(
    Object.entries(node).map(([k, v]) => [k, typeof v === "string" ? leaf([...path, k], v) : mapLeaves(v, [...path, k], leaf)]),
  );
}

const colorTheme = () => mapLeaves(palette, [], (path) => `rgb(var(${varName(path)}) / <alpha-value>)`);

function rootVars() {
  const vars: Record<string, string> = {};
  mapLeaves(palette, [], (path, hex) => {
    vars[varName(path)] = hexToRgbChannels(hex);
    return hex;
  });
  return vars;
}

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
      // Warm paper + forest-ink + clinical teal; hex lives in palette.ts and reaches
      // the page as CSS vars, so a future dark theme only has to redefine them.
      colors: colorTheme(),
      boxShadow: {
        panel: "0 1px 2px rgb(var(--ink) / 0.04), 0 1px 1px rgb(var(--ink) / 0.03)",
      },
      borderRadius: {
        md: "0.5rem",
        lg: "0.75rem",
      },
    },
  },
  plugins: [plugin(({ addBase }) => addBase({ ":root": rootVars() }))],
};
export default config;
