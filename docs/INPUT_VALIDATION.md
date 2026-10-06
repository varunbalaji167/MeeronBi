# Input validation — foundation + field-by-field audit

The reusable input-hardening foundation, plus a field-by-field audit of
where it has been applied and where it is still recommended. The structure
is deliberate: applying a "recommended" row later is a mechanical
field-config edit using the pieces already built, needing no new
architecture.

## Why this exists

(1) Free-text fields that are really closed sets fragment analytics
(`Imphal East` vs `imphal east`). (2) Nothing on the server enforced that
a `select`'s value matched its options, or that a payload shape was sane.
Both are the same work from two ends.

## The foundation

These are the reusable pieces — build once, apply everywhere, nothing here
needs revisiting when the next field gets tightened:

1. **`FieldConfig.allowOther`** (`domain/tabs/types.ts`) — a `select`/
   `radio` field can now offer a closed list *and* an "Other (please
   specify)" escape hatch, instead of the all-or-nothing choice between a
   rigid dropdown and free text. `FieldInput.tsx` renders the toggle;
   `sanitizeTabData` (below) knows to let the custom value through only
   when this flag is set.
2. **`domain/textPatterns.ts`** — shared, reusable pieces instead of the
   same regex/list copy-pasted per field: `NAME_PATTERN` (any-script
   person names), `PLACE_NAME_PATTERN` (place names), `MANIPUR_DISTRICTS`
   (the current 16, verified against the Dec-2016 reorganization — not
   assumed from memory), `COMMON_OCCUPATIONS`, `COMMON_RELIGIONS`.
3. **`sanitizeTabData` rewrite** (`domain/validation.ts`) — this ran on
   every save before, but only touched `phone` fields and only walked
   plain sections. It now:
   - Walks **all three** section kinds — plain, grid (Investigation's
     Thyroid/Reactive/ECHO tables, Ultrasound's Soft Markers/Doppler
     tables), and repeating (History's Obstetric History, Treatments'
     visit/course rows). Those last two previously got **zero**
     sanitization of any kind — the largest gap this closed.
   - Rebuilds the record from the tab's own field list as an **allowlist**
     rather than patching the client's object in place, so a payload key
     that isn't a real field on that tab is simply never carried over.
   - Per field, narrows the value to what its `type` could honestly hold:
     `select`/`radio` must be one of `options` (or, with `allowOther`, any
     string up to 120 chars); `multiselect` is filtered to known options,
     de-duplicated, and capped; `number` must actually be a finite number;
     `date`/`time` must match their shape; `text`/`textarea` are
     control-character-stripped and length-capped (`maxLength` if set,
     else 300/3000); a repeating section's row array is capped at its
     `maxCount` (or 60) so a hand-built request can't bloat storage with a
     huge array.
   - Still never *rejects* a draft save — narrows/drops a bad value to
     null rather than blocking, consistent with "drafts are never
     validated" everywhere else in this app. Only **Mark Complete** can
     still be blocked, unchanged, via `getFieldLevelErrors`.
4. **DOM-level hardening** (`FieldInput.tsx`) — `number` inputs now carry
   native `min`/`max` from `validation`; text inputs carry a native
   `pattern` from `validation.pattern` (supplementary browser-native
   hinting; the actual error message a person sees is still the existing
   onBlur check).
5. Tightened the three loose `"fields" in section` duck-type checks in
   `validation.ts` to the proper `isPlainSection` type guard — those
   silently included repeating sections too (harmless today since no row
   field name collides with a top-level field name, but worth closing
   while touching this file).

## Applied

| Tab | Field | Before | After | Why |
|---|---|---|---|---|
| Personal | `district` | `text` | `select` + `allowOther`, `MANIPUR_DISTRICTS` | The Analytics module's own example chart ("Patient Count by District") depends on this being clean categorical data. Manipur's 16 districts are a small, stable, official list. |
| Personal | `religion` | `text` | `select` + `allowOther`, `COMMON_RELIGIONS` | Small, well-known set; feeds categorical analytics the same way. |
| Personal | `profession` | `text` | `select` + `allowOther`, `COMMON_OCCUPATIONS` | Common cases now consistent; `allowOther` keeps genuine outliers recordable. |
| Personal | `spouseOccupation` | `text` | `select` + `allowOther`, `COMMON_OCCUPATIONS` | Same reasoning as `profession`. |
| Personal | `fullName`, `surname`, `name`, `spouseName` | `text`, no pattern | `text` + `NAME_PATTERN` + `maxLength` | Still free text (names are too varied for a closed list) but now rejects non-name junk (digits, symbols) instead of accepting anything. |
| Personal | `cityTown` | `text`, no pattern | `text` + `PLACE_NAME_PATTERN` + `maxLength` | **Deliberately NOT converted to `select`** — unlike District, there's no small authoritative list of every settlement in a catchment area to responsibly hardcode. Pattern-restricted instead; see "Open items" below for a possible follow-up. |
| History | `obstetricIndex` | `text`, no pattern | `text` + pattern `^G\d{1,2}P\d{3,4}$` | It's a structured clinical code (GxPxxxx), not free text. |
| Investigation | `plateletCount`, `randomBloodSugar`, `gttDipsi` | `text` | `number` + range validation | These are lab values that were free text in the source mockup — converting makes them consistent with every other lab field on this tab AND makes them Analytics-eligible as Ratio data (see `domain/analytics/types.ts` §3's type-mapping rule — `text` fields are excluded from the picker entirely). |
| Ultrasound | `pogWeeksDays` | `text` | `number` + range validation | Every other POG field on this tab is already numeric; this one was the odd one out. |
| Ultrasound | `afiLevel1` | `text`, no validation | `number` + range validation | Inconsistent with the same "AFI Level" concept recorded again later on the same tab (`afiLevel2`, already numeric) — made consistent. |
| Treatments | `pogWeeks` (both `measurements` and `courses`) | `text` | `number` + range validation | Same reasoning as Ultrasound's `pogWeeksDays`. |

## Full audit — everything else

Legend: **Keep** = already the right type/validation, no change needed.
**Recommended** = a good candidate for the same treatment, not yet applied
(the infra above already supports doing this — it's a config edit, not new
plumbing).

### Personal (remaining)
| Field | Type | Status |
|---|---|---|
| `mrn` | `text` + pattern | Keep — already pattern-validated (see `RECORD_NUMBER_PATTERN`'s reasoning in `textPatterns.ts`). |
| `contactNo` | `phone` | Keep — already has its own dedicated hardened control (`domain/phone.ts`). |
| `dob`, `lmp`, `edd`, `usgEdd` | `date` | Keep — cross-field checks already exist in `fieldValidators`. |
| `heightCm`, `weightFirstVisitKg`, `weightLastVisitKg` | `number` + range | Keep. |
| `highestEducation`, `income`, `spouseEducation`, `spouseIncome` | `select` | Keep — already closed lists. |
| `address`, `landmark` | `text` | Keep as free text (see rationale inline in `personal.ts`) — length-capped, control-stripped server-side regardless. |
| `pin` | `text` + `maxLength` | Keep — intentionally country-agnostic (see existing comment in `personal.ts`); could add a light "must be alphanumeric, no spaces" pattern later if this deployment is known to be single-country. |

### History (remaining)
| Field | Type | Status |
|---|---|---|
| `infertilityType`, `conceptionType`, `lastChildbirth`, `reasonForMtp` | `select` | Keep. |
| `oicMethod`, `medicalHistory`, `surgicalHistory`, `pregnancyComplications` | `multiselect` | Keep — already closed option sets; now properly sanitized server-side too (see Foundation §3). |
| `medicalHistoryOthers`, `surgicalHistoryOthers`, `pregnancyComplicationsOthers` | `text` | Keep as free text ("please specify" companions to the multiselects above) — length-capped by the default sanitizer. |
| `noOfBoys`, `noOfGirls`, `noCesareanDelivery`, `noVaginalDelivery`, `noSponAbortions`, `noMtp` | `select` (count options) | Keep. |
| Obstetric History row fields (`conception`, `complications`, `outcome`, `management`, `noOfBabies`, `gender1-3`) | `select` | Keep. |
| Obstetric History `remarks` | `textarea` | Keep — genuinely free text. |
| Obstetric History `weight1-3Kg` | `number` | Keep. |

### Investigation (remaining)
Almost entirely `number`/`select`/`radio` already (see the Analytics
cross-check pass — this tab was already the most numeric-heavy). No further
changes recommended beyond the three converted above.

### Ultrasound (remaining)
Almost entirely `number`/`select`/`radio`/grid already. No further changes
recommended beyond the two converted above.

### Delivery (remaining)
| Field | Type | Status |
|---|---|---|
| `admissionType`, `medicoLegalCase`, `garvidaNo`, `labourType`, `indication`, `method`, `timesInduced`, `deliveryMode`, `indicationForInstDelivery`, `noOfBabies`, `sexOfBaby`, `nicuAdmission`, `neonatalComplications`, `labourComplications`, `postPartumComplications` | `select`/`radio` | Keep — already closed lists. |
| `indicationsOfCs` | `multiselect` | Keep. |
| `pogOnDeliveryWeeks`, `babyWeightKg`, `apgarScore` | `number` + range | Keep. |
| `dateOfDelivery`, `timeOfDelivery` | `date`/`time` | Keep. |
| `cmf` (Congenital malformations) | `text` | **Recommended**: `select` + `allowOther` with a curated common list (none currently exist in `textPatterns.ts` — would need a small `COMMON_CONGENITAL_MALFORMATIONS` list added first). Left as free text, since a bad guess at "common" here is a clinical accuracy risk in a way a common-occupations list isn't — worth getting input from whoever owns the clinical requirements before curating it. |
| `hospitalNameAddress` | `textarea` | Keep — genuinely free text. |

### Robson
All 6 fields are `radio` with a small fixed option set already — nothing
to harden.

### Treatments (remaining)
| Field | Type | Status |
|---|---|---|
| `measurements` row: `weightKg`, `bmi`, `bpHigh`, `bpLow`, `tsh`, `freeT4`, `sugarFasting`, `sugarPp` | `number` | Keep. |
| `courses` row: `dosage`, `frequency`, `gapsHrs`, `courseDays` | `number` | Keep. |
| `courses` row: `unit`, `perDays` | `select` | Keep. |
| `courses` row: `condition` | `text` | **Recommended**: `select` + `allowOther` with common pregnancy-related conditions (Gestational diabetes, Hypothyroidism, Anemia, PIH, UTI, Bronchial asthma, ...) — same "needs a clinically-reviewed list first" caveat as Delivery's `cmf` above. |
| `courses` row: `drug`, `instructions` | `text` | Keep as free text — drug names and dosing instructions are too varied for a closed list, and unlike a name or place field, restricting the character class would block legitimate entries (dosages like "Iron 60mg + Folic acid 500mcg"). |

## Open items worth a decision before going further

1. **City/Town** (`personal.ts`) stayed free text (pattern-restricted) by
   deliberate choice rather than converted to `select`, since there's no
   small authoritative list the way District has. If this deployment
   serves a small, known set of towns, the hospital's own catchment-area
   list could be added the same way `MANIPUR_DISTRICTS` was — same
   mechanism, just needs that list from whoever owns the deployment.
2. **`cmf` and `condition`** (above) are both good `allowOther` candidates
   blocked on getting a clinically-reviewed common-values list, not on
   anything technical.
3. **Grid-cell field configs** (`GridSectionConfig.valueColumns`) don't
   carry `allowOther` in their type today — only full `FieldConfig` does.
   None of the current grid cells need it, but if one ever does, that's a
   one-line type addition to `GridSectionConfig`, not a redesign.
