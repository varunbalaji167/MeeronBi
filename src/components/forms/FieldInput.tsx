"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, User } from "lucide-react";
import { FieldConfig } from "@/domain/tabs";
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
}

const ICON_MAP = { phone: Phone, email: Mail, location: MapPin, user: User };

export default function FieldInput({ field, value, onChange, onBlur, error, disabled, compact }: Props) {
  // Always called (rules of hooks) even though only the `allowOther` select
  // branch below uses it — tracks "the person clicked Other and is mid-way
  // through typing a custom value" independently of `value` itself, since
  // once they've cleared the box to start typing, `value` alone can't tell
  // "empty because Other, about to type" apart from "empty, not started".
  const [otherMode, setOtherMode] = useState(false);

  const Icon = field.icon ? ICON_MAP[field.icon] : null;
  const inputClass = `input-field ${Icon ? "pl-9" : ""} ${
    error ? "!border-rose-400 focus:!border-rose-400 focus:!ring-rose-400" : ""
  }`;

  const commonProps = {
    id: field.name,
    disabled,
    className: inputClass,
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    onBlur,
  };

  const wrap = (input: React.ReactNode) => (
    <div>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        )}
        {input}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );

  switch (field.type) {
    // Composite country-code + national-number control. Digits are
    // stripped live as the person types (not just validated after the
    // fact), and the number portion is hard-capped in the DOM — both are
    // enforced here, in the browser, before anything is ever sent to the
    // server, so an over-length or non-numeric phone number literally
    // cannot be entered in the first place.
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
              // Re-clamp the existing digits to the newly selected
              // country's max length too, so switching country never
              // leaves an over-length number sitting in the field.
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
            id={field.name}
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

      // A value that's set but isn't one of the listed options can only be
      // a previously-saved "Other" entry — treat it the same as the person
      // having just picked "Other" this session.
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
      return (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((opt) => (
            <button
              type="button"
              key={opt}
              disabled={disabled}
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
      return (
        <div className="flex flex-wrap gap-4 pt-1">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-ink-soft">
              <input
                type="radio"
                name={field.name}
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
          // Native `pattern` is supplementary DOM-level hinting (mobile
          // keyboards, browser-native validation UI) — the actual
          // enforcement a person sees is the onBlur check that produces
          // `error` above, since a bare `pattern` mismatch gives no visible
          // feedback of its own until form submission.
          pattern={field.validation?.pattern?.source}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
