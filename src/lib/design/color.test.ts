import { describe, it, expect } from "vitest";
import { hexToRgbChannels } from "./color";

describe("hexToRgbChannels", () => {
  it("converts a 6-digit hex to space-separated channels", () => {
    expect(hexToRgbChannels("#0E6B5C")).toBe("14 107 92");
  });

  it("expands 3-digit shorthand", () => {
    expect(hexToRgbChannels("#fff")).toBe("255 255 255");
    expect(hexToRgbChannels("#0a8")).toBe("0 170 136");
  });

  it("throws on malformed input", () => {
    expect(() => hexToRgbChannels("teal")).toThrow();
    expect(() => hexToRgbChannels("#ggg")).toThrow();
    expect(() => hexToRgbChannels("#12345")).toThrow();
  });
});
