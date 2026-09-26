import { describe, it, expect } from "vitest";
import { validateFieldValue, validateAllFields, sanitizeTabData, getIncompleteReasons, getFieldLevelErrors } from "./validation";
import { FieldConfig, TabConfig } from "./tabs/types";

// A small, self-contained tab exercising every field kind validation.ts handles.
const plainFields: FieldConfig[] = [
  { name: "fullName", label: "Full Name", type: "text", maxLength: 50 },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "age", label: "Age", type: "number", validation: { min: 18, max: 60, message: "Age must be 18-60." } },
  { name: "code", label: "9. Patient Code", type: "text", validation: { pattern: /^[A-Z]+$/ } },
  { name: "lmp", label: "LMP", type: "date" },
  { name: "edd", label: "EDD", type: "date" },
  { name: "visitTime", label: "Visit Time", type: "time" },
  { name: "district", label: "District", type: "select", options: ["North", "South"], allowOther: true },
  { name: "bloodGroup", label: "Blood Group", type: "select", options: ["O+", "O-"] },
  { name: "symptoms", label: "Symptoms", type: "multiselect", options: ["Fever", "Cough", "Nausea"] },
  { name: "contactNo", label: "Contact", type: "phone" },
];

const testTab: TabConfig = {
  key: "test",
  label: "Test",
  route: "test",
  requiredFields: ["fullName"],
  fieldValidators: {
    edd: (data) => (data.lmp && data.edd && new Date(data.edd) <= new Date(data.lmp) ? "EDD must be after LMP." : null),
  },
  sections: [
    { fields: plainFields },
    {
      kind: "grid",
      title: "Labs",
      valueColumns: [{ name: "result", label: "Result", type: "select", options: ["Positive", "Negative"] }],
      rows: [{ name: "hiv", label: "HIV" }],
    },
    {
      kind: "repeating",
      name: "visits",
      title: "Visits",
      maxCount: 3,
      fields: [
        { name: "weightKg", label: "Weight", type: "number" },
        { name: "note", label: "Note", type: "text" },
      ],
    },
  ],
};

describe("validateFieldValue", () => {
  const field = plainFields.find((f) => f.name === "age")!;
  const codeField = plainFields.find((f) => f.name === "code")!;
  const contactField = plainFields.find((f) => f.name === "contactNo")!;

  it("skips validation entirely for an empty value — emptiness is a 'required' concern, not this function's job", () => {
    expect(validateFieldValue(field, "")).toBeNull();
    expect(validateFieldValue(field, null)).toBeNull();
    expect(validateFieldValue(field, undefined)).toBeNull();
  });

  it("flags a number outside its min/max range, using the field's own message", () => {
    expect(validateFieldValue(field, 15)).toBe("Age must be 18-60.");
    expect(validateFieldValue(field, 65)).toBe("Age must be 18-60.");
    expect(validateFieldValue(field, 30)).toBeNull();
  });

  it("generates a fallback message from the field's label when none is given, stripping a leading '9. ' numbering prefix", () => {
    expect(validateFieldValue(codeField, "abc123")).toBe("Enter a valid patient code.");
    expect(validateFieldValue(codeField, "ABC")).toBeNull();
  });

  it("delegates 'phone' fields to domain/phone.ts's own length-by-country rule instead of the generic pattern/min/max path", () => {
    expect(validateFieldValue(contactField, { countryIso: "IN", number: "9876543210" })).toBeNull();
    expect(validateFieldValue(contactField, { countryIso: "IN", number: "98765" })).toMatch(/valid phone number/i);
  });
});

describe("validateAllFields", () => {
  it("collects every plain-section field's error into one name -> message map", () => {
    const errors = validateAllFields(testTab, { age: 5, code: "lowercase" });
    expect(errors.age).toBe("Age must be 18-60.");
    expect(errors.code).toBeTruthy();
  });

  it("also runs the tab's cross-field fieldValidators (EDD must be after LMP)", () => {
    const errors = validateAllFields(testTab, { lmp: "2024-06-01", edd: "2024-05-01" });
    expect(errors.edd).toBe("EDD must be after LMP.");
  });

  it("never validates grid or repeating section fields — see the module comment on why that's a deliberate scope boundary", () => {
    const errors = validateAllFields(testTab, { hiv__result: "not-a-real-option" });
    expect(errors.hiv__result).toBeUndefined();
  });
});

describe("sanitizeTabData — the server-side allowlist every save goes through", () => {
  it("drops any top-level key that isn't a real field on this tab — the core security property", () => {
    const result = sanitizeTabData(testTab, { fullName: "Jane Doe", injectedField: "<script>evil()</script>" });
    expect(result).not.toHaveProperty("injectedField");
    expect(result.fullName).toBe("Jane Doe");
  });

  describe("select / radio", () => {
    it("keeps a value that's one of the field's own options", () => {
      expect(sanitizeTabData(testTab, { bloodGroup: "O+" }).bloodGroup).toBe("O+");
    });

    it("drops an out-of-list value to null when the field has no allowOther escape hatch", () => {
      expect(sanitizeTabData(testTab, { bloodGroup: "Z+" }).bloodGroup).toBeNull();
    });

    it("keeps a custom out-of-list value, trimmed, when allowOther is true — but still caps its length", () => {
      const custom = sanitizeTabData(testTab, { district: "  Somewhere Else  " });
      expect(custom.district).toBe("Somewhere Else");

      const tooLong = sanitizeTabData(testTab, { district: "x".repeat(500) });
      expect(tooLong.district).toHaveLength(120);
    });
  });

  it("multiselect: filters to known options only, de-duplicates, and never trusts the client's array shape", () => {
    const result = sanitizeTabData(testTab, { symptoms: ["Fever", "Fever", "Cough", "NotARealSymptom"] });
    expect(result.symptoms).toEqual(["Fever", "Cough"]);

    expect(sanitizeTabData(testTab, { symptoms: "Fever" }).symptoms).toEqual([]);
  });

  it("number: keeps a real finite number, drops anything else (a numeric-looking STRING included) to null", () => {
    expect(sanitizeTabData(testTab, { age: 34 }).age).toBe(34);
    expect(sanitizeTabData(testTab, { age: "34" }).age).toBeNull();
    expect(sanitizeTabData(testTab, { age: NaN }).age).toBeNull();
  });

  it("date/time: keeps a value that looks like its expected shape, drops anything that doesn't", () => {
    expect(sanitizeTabData(testTab, { lmp: "2024-01-15" }).lmp).toBe("2024-01-15");
    expect(sanitizeTabData(testTab, { lmp: "not-a-date" }).lmp).toBeNull();
    expect(sanitizeTabData(testTab, { visitTime: "14:30" }).visitTime).toBe("14:30");
    expect(sanitizeTabData(testTab, { visitTime: "teatime" }).visitTime).toBeNull();
  });

  it("text: strips control characters and clamps to maxLength (or a sensible default)", () => {
    expect(sanitizeTabData(testTab, { fullName: "  Jane\x00 Doe  " }).fullName).toBe("Jane Doe");
    expect(sanitizeTabData(testTab, { fullName: "x".repeat(80) }).fullName).toHaveLength(50);

    expect(sanitizeTabData(testTab, { notes: "x".repeat(4000) }).notes).toHaveLength(3000);
  });

  it("textarea keeps newlines (control characters a person actually typed on purpose), unlike single-line text", () => {
    expect(sanitizeTabData(testTab, { notes: "Line one\nLine two" }).notes).toBe("Line one\nLine two");
  });

  it("phone: sanitizes a real PhoneValue (via domain/phone.ts), drops anything else", () => {
    const result = sanitizeTabData(testTab, { contactNo: { countryIso: "IN", number: "98-765-43210 extra digits" } });
    expect(result.contactNo).toEqual({ countryIso: "IN", number: "9876543210" });

    expect(sanitizeTabData(testTab, { contactNo: "9876543210" }).contactNo).toBeNull();
  });

  it("grid sections: sanitizes the flat '<row>__<column>' keys using the column's own type/options", () => {
    expect(sanitizeTabData(testTab, { hiv__result: "Positive" }).hiv__result).toBe("Positive");
    expect(sanitizeTabData(testTab, { hiv__result: "Maybe" }).hiv__result).toBeNull();
  });

  describe("repeating sections", () => {
    it("sanitizes every row's declared fields and drops anything undeclared within a row", () => {
      const result = sanitizeTabData(testTab, {
        visits: [{ weightKg: 62, note: "First visit", injectedRowField: "nope" }],
      });
      expect(result.visits).toEqual([{ weightKg: 62, note: "First visit" }]);
    });

    it("caps the number of rows at the section's maxCount, keeping the first N rather than trusting the client's array length", () => {
      const fiveVisits = Array.from({ length: 5 }, (_, i) => ({ note: `visit-${i}` }));
      const result = sanitizeTabData(testTab, { visits: fiveVisits });
      expect(result.visits).toHaveLength(3);
      expect(result.visits.map((v: any) => v.note)).toEqual(["visit-0", "visit-1", "visit-2"]);
    });

    it("tolerates a non-array or garbage row shape rather than throwing", () => {
      expect(sanitizeTabData(testTab, { visits: "not-an-array" }).visits).toEqual([]);
      expect(sanitizeTabData(testTab, { visits: [null, "garbage", 42] }).visits).toEqual([{}, {}, {}]);
    });
  });
});

describe("getIncompleteReasons / getFieldLevelErrors — the 'Mark Complete' gate (never applied to draft saves)", () => {
  it("lists a required field's LABEL when it's empty, and nothing when it's filled", () => {
    expect(getIncompleteReasons(testTab, {})).toEqual(["Full Name"]);
    expect(getIncompleteReasons(testTab, { fullName: "Jane Doe" })).toEqual([]);
  });

  it("getFieldLevelErrors merges format/range errors with 'required but empty' fields into one map for inline red text", () => {
    const errors = getFieldLevelErrors(testTab, { age: 5 });
    expect(errors.age).toBe("Age must be 18-60.");
    expect(errors.fullName).toBe("This field is required.");
  });

  it("prefers a tab's custom validateForComplete over requiredFields when both could apply", () => {
    const tabWithCustomCheck: TabConfig = {
      ...testTab,
      validateForComplete: () => ["Something tab-specific isn't ready"],
    };
    expect(getIncompleteReasons(tabWithCustomCheck, { fullName: "Jane Doe" })).toEqual([
      "Something tab-specific isn't ready",
    ]);
  });
});
