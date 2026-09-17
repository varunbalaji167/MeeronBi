// Re-exports the full public surface of the domain layer. Prefer importing
// from "@/domain" over reaching into "@/domain/tabs", "@/domain/phone", etc.
// directly, unless you specifically need a submodule not re-exported here.
export * from "./tabs";
export * from "./validation";
export * from "./fieldVisibility";
export * from "./phone";
export * from "./countryCodes";
