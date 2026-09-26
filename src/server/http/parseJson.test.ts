import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseJson } from "./parseJson";
import { ValidationError } from "./errors";

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().nonnegative(),
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parseJson", () => {
  it("returns the parsed, typed value when the body matches the schema", async () => {
    const result = await parseJson(jsonRequest({ name: "Tombi", age: 24 }), schema);
    expect(result).toEqual({ name: "Tombi", age: 24 });
  });

  it("throws a ValidationError with REQUEST.SHAPE_INVALID detail on a shape mismatch", async () => {
    let thrown: unknown;
    try {
      await parseJson(jsonRequest({ name: "Tombi", age: "not-a-number" }), schema);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).detail).toBe("REQUEST.SHAPE_INVALID");
  });

  it("maps zod's flatten().fieldErrors into a flat field -> message record, one message per field", async () => {
    let thrown: unknown;
    try {
      await parseJson(jsonRequest({ name: "", age: -1 }), schema);
    } catch (e) {
      thrown = e;
    }
    const fieldErrors = (thrown as ValidationError).fieldErrors;
    expect(Object.keys(fieldErrors ?? {}).sort()).toEqual(["age", "name"]);
    expect(typeof fieldErrors?.name).toBe("string");
    expect(typeof fieldErrors?.age).toBe("string");
  });

  it("throws a ValidationError (not a raw JSON parse error) when the body isn't valid JSON at all", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST", body: "not json" });
    let thrown: unknown;
    try {
      await parseJson(req, schema);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
  });
});
