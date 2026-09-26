import { describe, it, expect } from "vitest";
import { classifyDeliveryTiming } from "./delivery";

describe("classifyDeliveryTiming", () => {
  it("classifies under 37 weeks as premature", () => {
    expect(classifyDeliveryTiming(36)).toEqual({ label: "Premature delivery (before 37 weeks)", tone: "warn" });
  });

  it("classifies 37 through 40 weeks (inclusive on both ends) as normal", () => {
    expect(classifyDeliveryTiming(37)?.tone).toBe("ok");
    expect(classifyDeliveryTiming(38.5)?.tone).toBe("ok");
    expect(classifyDeliveryTiming(40)?.tone).toBe("ok");
  });

  it("classifies over 40 weeks as late", () => {
    expect(classifyDeliveryTiming(41)).toEqual({ label: "Late delivery (after 40 weeks)", tone: "warn" });
  });

  it("accepts a numeric string the same way as a number", () => {
    expect(classifyDeliveryTiming("39")).toEqual(classifyDeliveryTiming(39));
  });

  it("returns null for anything that isn't a usable number yet", () => {
    expect(classifyDeliveryTiming(null)).toBeNull();
    expect(classifyDeliveryTiming(undefined)).toBeNull();
    expect(classifyDeliveryTiming("")).toBeNull();
    expect(classifyDeliveryTiming("not a number")).toBeNull();
  });
});
