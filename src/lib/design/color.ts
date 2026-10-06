/** "#0E6B5C" -> "14 107 92": the channel form Tailwind needs for `<alpha-value>` opacity modifiers. */
export function hexToRgbChannels(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  // Bare throw is deliberate: this runs in build-time config, where a bad token should fail the build loudly.
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(" ");
}
