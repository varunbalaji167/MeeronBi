import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO, findCountryByIso } from "./countryCodes";

/** How a "phone" field stores its value: country + national number, kept separate. */
export interface PhoneValue {
  countryIso: string; // ISO 3166-1 alpha-2, e.g. "IN", "US", "GB"
  number: string; // digits only, national number (no country code, no leading 0/+)
}

export function isPhoneValue(v: unknown): v is PhoneValue {
  return !!v && typeof v === "object" && "countryIso" in (v as any) && "number" in (v as any);
}

export function emptyPhoneValue(): PhoneValue {
  return { countryIso: DEFAULT_COUNTRY_ISO, number: "" };
}

/** Strips everything but digits — used both live (as-you-type) and on save. */
export function sanitizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** "+91 9863012345" — for read-only display (tables, patient view, etc). */
export function formatPhoneValue(v: PhoneValue | null | undefined): string {
  if (!v || !v.number) return "";
  const country = findCountryByIso(v.countryIso);
  return `${country?.dialCode ?? ""} ${v.number}`.trim();
}

/** Expected national number length by ISO country code: a fixed number, or a [min, max] range. */
const PHONE_LENGTH_BY_ISO: Record<string, number | [number, number]> = {
  AF: 9, AL: 9, DZ: 9, AR: [10, 11], AM: 8, AU: 9, AT: [10, 11], AZ: 9,
  BD: 10, BY: 9, BE: 9, BJ: 8, BT: 8, BO: 8, BA: 8, BW: 8, BR: [10, 11],
  BG: 9, BF: 8, BI: 8, KH: [8, 9], CM: 9, CA: 10, CF: 8, TD: 8, CL: 9,
  CN: 11, CO: 10, CD: 9, CR: 8, HR: 9, CU: 8, CY: 8, CZ: 9, DK: 8, DJ: 8,
  DO: 10, EC: 9, EG: 10, SV: 8, EE: [7, 8], ET: 9, FJ: 7, FI: [9, 10],
  FR: 9, GA: 8, GM: 7, GE: 9, DE: [10, 11], GH: 9, GR: 10, GT: 8, GN: 9,
  HT: 8, HN: 8, HK: 8, HU: 9, IS: 7, IN: 10, ID: [9, 12], IR: 10, IQ: 10,
  IE: 9, IL: 9, IT: [9, 10], CI: 10, JM: 10, JP: 10, JO: 9, KZ: 10, KE: 9,
  KW: 8, KG: 9, LA: 9, LV: 8, LB: 8, LS: 8, LR: 8, LY: 9, LT: 8, LU: 9,
  MO: 8, MG: 9, MW: 9, MY: [9, 10], MV: 7, ML: 8, MT: 8, MX: 10, MD: 8,
  MN: 8, ME: 8, MA: 9, MZ: 9, MM: [8, 10], NA: 9, NP: 10, NL: 9, NZ: [8, 9],
  NI: 8, NE: 8, NG: 10, NO: 8, OM: 8, PK: 10, PA: 8, PG: 8, PY: 9, PE: 9,
  PH: 10, PL: 9, PT: 9, QA: 8, RO: 9, RU: 10, RW: 9, SA: 9, SN: 9, RS: 9,
  SL: 8, SG: 8, SK: 9, SI: 8, SO: 8, ZA: 9, KR: [9, 10], SS: 9, ES: 9,
  LK: 9, SD: 9, SE: [7, 9], CH: 9, SY: 9, TW: [9, 10], TJ: 9, TZ: 9, TH: 9,
  TG: 8, TN: 8, TR: 10, TM: 8, UG: 9, UA: 9, AE: 9, GB: 10, US: 10, UY: 8,
  UZ: 9, VE: 10, VN: [9, 10], YE: 9, ZM: 9, ZW: 9,
};

/** Fallback for any country not in the table above. */
export const DEFAULT_PHONE_LENGTH = { min: 7, max: 12 };

export function getPhoneLengthRange(countryIso: string): { min: number; max: number } {
  const entry = PHONE_LENGTH_BY_ISO[countryIso];
  if (entry === undefined) return DEFAULT_PHONE_LENGTH;
  return Array.isArray(entry) ? { min: entry[0], max: entry[1] } : { min: entry, max: entry };
}

/** The hard cap used for the input's DOM `maxlength` for the currently-selected country. */
export function getMaxDigitsForCountry(countryIso: string): number {
  return getPhoneLengthRange(countryIso).max;
}

/** Re-derives a value that satisfies the current country's length rule — used when the country changes. */
export function sanitizePhoneValue(v: PhoneValue): PhoneValue {
  const { max } = getPhoneLengthRange(v.countryIso);
  return { countryIso: v.countryIso, number: sanitizePhoneDigits(v.number).slice(0, max) };
}

export function validatePhoneValue(v: PhoneValue | null | undefined): string | null {
  if (!v || !v.number) return null;
  if (!findCountryByIso(v.countryIso)) return "Select a country for this phone number.";

  const digits = sanitizePhoneDigits(v.number);
  const { min, max } = getPhoneLengthRange(v.countryIso);
  if (digits.length < min || digits.length > max) {
    const country = findCountryByIso(v.countryIso)?.name ?? "this country";
    const expected = min === max ? `exactly ${min} digits` : `${min}-${max} digits`;
    return `Enter a valid phone number for ${country} (${expected}).`;
  }
  return null;
}

export { COUNTRY_CODES };
