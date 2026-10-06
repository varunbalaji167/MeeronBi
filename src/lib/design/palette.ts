// Single source of truth for colour hex — consumed by tailwind.config.ts (as CSS vars) and chartTheme.ts.
// No imports: tailwind.config.ts loads this via jiti, which ignores tsconfig paths.

export const brand = {
  50: "#E9F3F0",
  100: "#D3E7E1",
  200: "#A6CFC2",
  300: "#79B7A4",
  400: "#3D8E77",
  500: "#0E6B5C",
  600: "#0A5347",
  700: "#083F37",
  800: "#062C27",
  900: "#041D1A",
} as const;

export const gold = {
  50: "#FBF1DD",
  100: "#F6E4BC",
  200: "#EBC97A",
  300: "#DAB361",
  400: "#C99C47",
  500: "#B8862E",
  600: "#8C6520", // darkened from #8F6820: badge-draft was 4.49:1, now 4.69:1
  700: "#6B4D18",
  800: "#4A3510",
  900: "#33250B",
} as const;

export const rose = {
  50: "#FBEAE9",
  100: "#F4CFCC",
  200: "#E7A8A4",
  300: "#D08682",
  400: "#BA645F",
  500: "#A3423D",
  600: "#812F2B",
  700: "#622320",
  800: "#451816",
  900: "#2E0F0E",
} as const;

// Names ink/paper/line stay as-is: they're already semantic and used across the app.
export const ink = { DEFAULT: "#1B2420", soft: "#3F473F", faint: "#6B7268", inverse: "#FFFFFF" } as const;
export const paper = { DEFAULT: "#F6F6F2", raised: "#FFFFFF", sunken: "#EEEEE7" } as const;
// `strong` is for form-control borders (3.16:1 on white); `DEFAULT` is decorative dividers only.
export const line = { DEFAULT: "#E1E0D5", soft: "#ECEBE1", strong: "#8C9389" } as const;

export const danger = { DEFAULT: rose[500], soft: rose[50], border: rose[400], strong: rose[600] } as const;
export const warning = { DEFAULT: gold[500], soft: gold[50], border: gold[200], strong: gold[600] } as const;
export const success = { DEFAULT: brand[500], soft: brand[50], border: brand[200], strong: brand[700] } as const;
export const focus = brand[400];

/** Everything Tailwind exposes as a colour (and as a `--<name>` custom property). */
export const palette = { ink, paper, line, brand, gold, rose, danger, warning, success, focus } as const;

/** Chart-only colours that aren't general UI tokens, so they stay out of `palette`. */
export const chartExtras = { suppressed: "#B8B6A9", referenceBand: "#94A39B" } as const;
