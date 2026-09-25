import { describe, it, expect } from "vitest";
import { validatePhoneValue, sanitizePhoneValue, sanitizePhoneDigits, formatPhoneValue, getPhoneLengthRange } from "./phone";

describe("getPhoneLengthRange", () => {
  it("uses a country's real numbering-plan length when known (India: exactly 10 digits)", () => {
    expect(getPhoneLengthRange("IN")).toEqual({ min: 10, max: 10 });
  });

  it("supports a [min, max] range for countries whose plan genuinely varies (Germany: 10-11 digits)", () => {
    expect(getPhoneLengthRange("DE")).toEqual({ min: 10, max: 11 });
  });

  it("falls back to a conservative default range for any country not in the table", () => {
    expect(getPhoneLengthRange("XX")).toEqual({ min: 7, max: 12 });
  });
});

describe("validatePhoneValue", () => {
  it("skips validation for an empty number — emptiness is a 'required' concern elsewhere", () => {
    expect(validatePhoneValue(null)).toBeNull();
    expect(validatePhoneValue({ countryIso: "IN", number: "" })).toBeNull();
  });

  it("accepts a number matching its country's exact expected length", () => {
    expect(validatePhoneValue({ countryIso: "IN", number: "9876543210" })).toBeNull();
  });

  it("rejects a number that's too short OR too long for its country — not just 'under some generous global ceiling'", () => {
    expect(validatePhoneValue({ countryIso: "IN", number: "987654321" })).toBe(
      "Enter a valid phone number for India (exactly 10 digits)."
    );
    expect(validatePhoneValue({ countryIso: "IN", number: "98765432100" })).toBe(
      "Enter a valid phone number for India (exactly 10 digits)."
    );
  });

  it("the SAME digit count that's invalid for one country can be valid for another", () => {
    // 11 digits: too many for India, exactly right for China.
    expect(validatePhoneValue({ countryIso: "IN", number: "98765432100" })).not.toBeNull();
    expect(validatePhoneValue({ countryIso: "CN", number: "98765432100" })).toBeNull();
  });

  it("rejects an unrecognized country code entirely, before even checking length", () => {
    expect(validatePhoneValue({ countryIso: "ZZ", number: "123" })).toBe("Select a country for this phone number.");
  });
});

describe("sanitizePhoneDigits / sanitizePhoneValue", () => {
  it("strips everything but digits", () => {
    expect(sanitizePhoneDigits("(987) 654-3210")).toBe("9876543210");
  });

  it("re-derives a value truncated to the CURRENT country's max length — used when the country dropdown changes", () => {
    // Say the number was entered while "US" (10 digits) was selected, then
    // the country was switched to somewhere with a shorter plan.
    const result = sanitizePhoneValue({ countryIso: "AM", number: "987654321" }); // Armenia: exactly 8
    expect(result).toEqual({ countryIso: "AM", number: "98765432" });
  });
});

describe("formatPhoneValue", () => {
  it("renders as '<dial code> <number>' for display", () => {
    expect(formatPhoneValue({ countryIso: "IN", number: "9876543210" })).toBe("+91 9876543210");
  });

  it("renders as an empty string when there's nothing to show", () => {
    expect(formatPhoneValue(null)).toBe("");
    expect(formatPhoneValue({ countryIso: "IN", number: "" })).toBe("");
  });
});
