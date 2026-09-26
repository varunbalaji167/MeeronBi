"use client";

import { AnalyticsFieldMeta } from "@/domain/analytics/types";
import FieldPicker, { fieldRefKey } from "./FieldPicker";

interface Props {
  /** The candidate list to pick from — see FieldPicker's own `fields` prop. */
  fields: AnalyticsFieldMeta[];
  value: AnalyticsFieldMeta | null;
  onChange: (field: AnalyticsFieldMeta | null) => void;
  /** The field already chosen for analysis — excluded from the filter's own options so field === filter is never selectable (the server would reject it with ANALYTICS.SAME_FIELD_AS_FILTER). */
  excludeField: AnalyticsFieldMeta | null;
  label?: string;
  placeholder?: string;
}

/** Thin wrapper around FieldPicker for a second (Filter) field — same picker, but clearable and excluding whatever's chosen as the field to analyze. */
export default function FilterPicker({
  fields,
  value,
  onChange,
  excludeField,
  label = "Filter by (optional)",
  placeholder = "Search fields to compare against...",
}: Props) {
  return (
    <FieldPicker
      fields={fields}
      value={value}
      onChange={onChange}
      onClear={() => onChange(null)}
      excludeKey={excludeField ? fieldRefKey(excludeField) : null}
      label={label}
      placeholder={placeholder}
    />
  );
}
