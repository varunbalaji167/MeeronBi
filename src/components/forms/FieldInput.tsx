"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, User } from "lucide-react";
import { FieldConfig } from "@/domain/tabs";
import { fieldIds } from "./fieldIds";
import {
  COUNTRY_CODES,
  PhoneValue,
  emptyPhoneValue,
  isPhoneValue,
  sanitizePhoneDigits,
  getMaxDigitsForCountry,
  getPhoneLengthRange,
  sanitizePhoneValue,
} from "@/domain/phone";

interface Props {
  field: FieldConfig;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  compact?: boolean;
  /** Disambiguates ids and radio names when the same field renders more than once (repeating rows). */
  idScope?: string;
  /** Accessible name for controls with no visible label of their own (table cells). */
  ariaLabel?: string;
}

const ICON_MAP = { phone: Phone, email: Mail, location: MapPin, user: User };

export default function FieldInput({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  compact,
  idScope,
  ariaLabel,
}: Props) {
  // Tracks whether the person picked "Other" and is typing a custom value.
  const [otherMode, setOtherMode] = useState(false);

  const Icon = field.icon ? ICON_MAP[field.icon] : null;
  const inputClass = `input-field ${Icon ? "pl-9" : ""} ${
    error ? "border-danger-border focus:border-danger-border focus:ring-danger-border" : ""
  }`;

  // Help text is skipped in compact table cells, where the column header already explains the field.
  const helpText = compact ? undefined : field.helpText;
  const { inputId, errorId, helpId, labelId, describedBy } = fieldIds(field.name, {
    scope: idScope,
    hasError: !!error,
    hasHelp: !!helpText,
  });

  const a11yProps = {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
  };

  const commonProps = {
    id: inputId,
    disabled,
    className: inputClass,
    placeholder: field.placeholder,
    onBlur,
    "aria-label": ariaLabel,
    ...a11yProps,
  };

  // Group controls are named by PlainSection's label span, or by ariaLabel where there's no visible label.
  const groupProps = {
    id: inputId,
    tabIndex: -1, // focusable programmatically so focus-first-error can land on the group
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabel ? undefined : labelId,
    ...a11yProps,
  };

  const wrap = (input: React.ReactNode) => (
    <div>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        )}
        {input}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger-strong">
          {error}
        </p>
      )}
      {helpText && (
        <p id={helpId} className="mt-1 text-xs text-ink-faint">
          {helpText}
        </p>
      )}
    </div>
  );

  switch (field.type) {
    // Country-code + national-number control; digits are stripped and length-capped live.
    case "phone": {
      const phoneValue: PhoneValue = isPhoneValue(value) ? value : emptyPhoneValue();
      const { min, max } = getPhoneLengthRange(phoneValue.countryIso);
      const lengthHint = min === max ? `${min} digits` : `${min}-${max} digits`;
      return wrap(
        <div className="flex gap-2">
          <select
            aria-label="Country code"
            disabled={disabled}
            className="input-field w-[5.5rem] shrink-0 !pl-2 !pr-1 text-xs"
            value={phoneValue.countryIso}
            onChange={(e) => {
              // Re-clamp digits to the new country's max length.
              const next = sanitizePhoneValue({ ...phoneValue, countryIso: e.target.value });
              onChange(next);
            }}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.dialCode} {c.iso}
              </option>
            ))}
          </select>
          <input
            id={inputId}
            aria-label={ariaLabel}
            {...a11yProps}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            disabled={disabled}
            maxLength={getMaxDigitsForCountry(phoneValue.countryIso)}
            className="input-field flex-1"
            placeholder={lengthHint}
            value={phoneValue.number}
            onBlur={onBlur}
            onChange={(e) =>
              onChange({
                ...phoneValue,
                number: sanitizePhoneDigits(e.target.value).slice(0, getMaxDigitsForCountry(phoneValue.countryIso)),
              })
            }
          />
        </div>
      );
    }

    case "textarea":
      return wrap(
        <textarea
          {...commonProps}
          maxLength={field.maxLength}
          rows={compact ? 2 : 3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select": {
      if (!field.allowOther) {
        return wrap(
          <select {...commonProps} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      // A saved value not in the options list is treated as an "Other" entry.
      const isOtherValue = typeof value === "string" && value !== "" && !field.options?.includes(value);
      const showOtherBox = otherMode || isOtherValue;

      if (showOtherBox) {
        return wrap(
          <div className="flex gap-2">
            <input
              {...commonProps}
              type="text"
              className={`${inputClass} flex-1`}
              placeholder="Please specify"
              maxLength={field.maxLength ?? 120}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
            />
            {!disabled && (
              <button
                type="button"
                className="shrink-0 whitespace-nowrap text-xs text-brand-600 hover:underline"
                onClick={() => {
                  setOtherMode(false);
                  onChange("");
                }}
              >
                Choose from list
              </button>
            )}
          </div>
        );
      }

      return wrap(
        <select
          {...commonProps}
          value={value ?? ""}
          onChange={(e) => {
            if (e.target.value === "__other__") {
              setOtherMode(true);
              onChange("");
            } else {
              onChange(e.target.value);
            }
          }}
        >
          <option value="">Choose...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          <option value="__other__">Other (please specify)</option>
        </select>
      );
    }

    case "multiselect": {
      const selected: string[] = Array.isArray(value) ? value : [];
      function toggle(opt: string) {
        if (selected.includes(opt)) onChange(selected.filter((v) => v !== opt));
        else onChange([...selected, opt]);
      }
      return wrap(
        <div role="group" className="flex flex-wrap gap-2" {...groupProps}>
          {field.options?.map((opt) => (
            <button
              type="button"
              key={opt}
              disabled={disabled}
              aria-pressed={selected.includes(opt)}
              onClick={() => toggle(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected.includes(opt)
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line text-ink-soft hover:border-brand-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    case "radio":
      return wrap(
        <div role="radiogroup" className="flex flex-wrap gap-4 pt-1" {...groupProps}>
          {field.options?.map((opt, i) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-ink-soft">
              <input
                id={`${inputId}-${i}`}
                type="radio"
                name={inputId}
                disabled={disabled}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-3.5 w-3.5 accent-brand-500"
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case "date":
      return wrap(
        <input
          {...commonProps}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "time":
      return wrap(
        <input
          {...commonProps}
          type="time"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return wrap(
        <input
          {...commonProps}
          type="number"
          step="any"
          min={field.validation?.min}
          max={field.validation?.max}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );

    default:
      return wrap(
        <input
          {...commonProps}
          type="text"
          maxLength={field.maxLength}
          // Supplementary hint only; real validation is the onBlur check producing `error`.
          pattern={field.validation?.pattern?.source}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
