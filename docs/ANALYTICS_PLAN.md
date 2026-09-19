# Analytics — design plan (not yet implemented)

Status: **draft**. Nothing in this document is wired into the running app.
`src/domain/analytics/types.ts` holds the draft types this plan refers to —
also not imported anywhere yet. This exists so the shape of the feature is
agreed before any aggregation/API/UI code is written.

Source: `MeeronBi_Default_indicators_to_be_recorded.pdf`, pages 8-18
("Analytics" through the "Standard Segments" appendix).

---

## 1. What's being asked for

Not a fixed dashboard — a **generic, self-service field-analytics engine**.
A person picks any one **Field** from the patient dataset, optionally a
second **Filter Field**, and the tool works out on its own what kind of
statistic and chart make sense for that pairing. Two modes:

- **Cohort mode** (pages 9-13): stats/charts across all patients.
- **Time-series mode** (pages 14-15, 18): one field's repeated
  measurements (TSH, weight, ...) plotted across the pregnancy, for one
  patient or averaged per filter-category across patients.

## 2. The decision matrix (cohort mode)

Every field is typed **Ratio** (continuous numeric) or **Categorical**
(nominal). Behavior branches on the Field/Filter pairing:

| Field | Filter | Result |
|---|---|---|
| Ratio | none | Central tendencies (avg/max/min/mode/SD) + bucket into brackets (a Standard Segment if one exists for this field, else a generic histogram) → bar chart |
| Ratio | Ratio | Scatter plot; user chooses which is X vs Y |
| Ratio | Categorical | Per-category stats + counts/% → grouped bar chart, filter on X-axis by default |
| Categorical | none | Count + % per distinct value → pie chart |
| Categorical | Categorical | Grouped bar chart of counts (or per-group averages, if a third ratio measure is implied — spec doesn't fully clarify this case, see open questions) |
| Categorical | Ratio | Bucket the ratio filter into a Standard Segment/histogram first, then treat as Categorical × Categorical |

## 3. Field classification rule

Derived from each field's `FieldConfig.type` (see `domain/tabs/types.ts`),
not hand-maintained per field:

| `FieldConfig.type` | Analytics treatment |
|---|---|
| `number` | Ratio |
| `select`, `radio` | Categorical |
| `multiselect` | Categorical, **exploded into one boolean sub-field per option** — a patient can have more than one condition selected, so a plain "count per value" would let percentages exceed 100%. Not addressed by the source spec; this is the cleanest fix. |
| `date` | Not directly analyzable. Feeds derived ratio fields (Age, gestational age) or serves as the time axis in time-series mode — never appears in the Field/Filter picker itself. |
| `text`, `textarea`, `phone`, `time` | Excluded from the picker (free text isn't summarizable this way; phone is PII) |

Fields living inside a **grid or repeating section** (Investigation's
Thyroid/ECHO grids, Treatments' visit rows, History's Obstetric History)
are flagged `multiValue: true` — a patient can have more than one entry, so
they're only eligible for **time-series mode**, not the simple cohort
single-value path, until bucketed by trimester (see §5).

## 4. Derived fields (not stored directly — computed at query time)

| id | Formula | Type |
|---|---|---|
| `age` | `(dateOfDelivery ?? edd ?? usgEdd) − dob`, in completed years | Ratio |
| `bmi` | `weightFirstVisitKg / (heightCm/100)²` | Ratio |
| gestational age at any dated entry | `computeGestationalAge(lmp, entryDate)` — **already built** in `domain/gestationalAge.ts` for the Ultrasound work; reused as-is here | — |

Note on `bmi`: the spec says "this is pre-pregnancy weight" but there's no
dedicated pre-pregnancy-weight field in the dataset — `weightFirstVisitKg`
("Wt. in First Visit") is the closest available proxy. Worth confirming
with whoever owns the clinical requirements before this ships, since it's
an assumption, not something the spec states outright.

## 5. Time-series mode

For a `multiValue` field (or Treatments' per-visit Weight/TSH/etc.), bucket
each entry into **Pre-pregnancy / Trimester 1 (wks 1-13) / T2 (14-27) / T3
(28-40)** using that entry's own date against the patient's LMP
(`computeGestationalAge`). Two views:
- **Single patient**: line chart of the buckets, optionally overlaid with
  a reference band (the PDF's TSH example plots the patient's line against
  lower/upper clinical limits — see `STANDARD_SEGMENTS.tsh` in the types
  file for the reference numbers).
- **Cohort, with a Filter Field selected**: one line per filter category,
  each point averaged across that category's patients for that trimester
  (page 15's per-district TSH example).

## 6. Standard Segments (Appendix A) — and corrections

The PDF defines brackets for four fields so they don't fall through to a
generic histogram. Two of the four needed correcting before they're usable
(see `STANDARD_SEGMENTS` in the types file for the actual numbers used):

- **Height**: as given, leaves 145.0-149.9cm uncovered between "Very
  Short" (`>145`, almost certainly meant `<145` given "Below 5 feet") and
  "Short" (`150-154.9`). Closed the gap.
- **BMI**: the source table is corrupted — two different clinical tables
  appear pasted on top of each other (`< 18.512.5 – 18.0 kg`,
  `18.5 – 24.911.5 – 16.0 kg`). The trailing `12.5–18.0 kg` / `11.5–16.0
  kg` fragments are IOM *gestational weight-gain* guidance, not BMI
  cutoffs — they don't belong in this table at all. Used the standard,
  uncorrupted WHO BMI bands instead.
- **Age** and **TSH-by-trimester**: used as given. **TSH ranges are
  lab/assay-dependent in real practice** — the given numbers are a
  reasonable default, but a hospital deploying this should be able to
  confirm or override them against their own lab, not have them hardcoded
  as clinical fact. `STANDARD_SEGMENTS.tsh` should probably become
  hospital-configurable later, the same way field-visibility already is
  (see `server/patients/fieldPreferenceService.ts` for the existing
  per-hospital-setting pattern this could follow).

Any Ratio field with **no** Standard Segment falls back to a generic
equal-width histogram, per the spec's own fallback rule.

## 7. The constraint that matters most: privacy

**This must be an authenticated, admin-only feature — not an extension of
the existing `/public/trends` page.** That page's own code comment is
explicit: aggregate-only, never small enough to re-identify anyone. A
generic "pick any field, filter by any other field" tool breaks that
invariant by design — the spec's own example table has **Thoubal: n=1**.
Filter Age=42 AND District=Thoubal AND HIV=Positive and you've deanonymized
a specific patient. Recommendation: gate this behind the existing
`requireAdmin` guard, and even then suppress/round any cell below a
minimum count (e.g. n<5) rather than trusting staff-only access alone to
make small-cell breakdowns safe.

**Update:** `docs/SCALING_PLAN.md`'s security section now has the fuller
version of this — a three-tier design (hardened public page / authenticated
`RESEARCHER` role with disclosure controls / differential privacy as a
later upgrade) written once the project's actual research-access goal
became explicit. This module's own access control should follow that
`RESEARCHER` tier once it exists, not stay bolted only to `ADMIN`.

## 8. Data-fetching strategy

`TabRecord.data` is JSON per patient per tab, not indexed per-field
columns — there's no `WHERE data->>'tsh' > 3` fast path in the schema as
it stands. At this app's real scale (a hospital's antenatal patients —
hundreds to low thousands, not millions), the pragmatic approach is:
fetch the relevant tab rows for the patient set, merge by `patientId` in
Node, compute stats/buckets in application code (a new
`server/analytics/` module, following the existing repository pattern in
`server/patients/` and `server/trends/`). Building a proper OLAP/columnar
pipeline for this volume would be over-engineering; revisit only if
patient volume grows by orders of magnitude, at which point denormalizing
hot fields the way `Delivery.deliveryMode`/`RobsonClassification
.groupNumber` already are would be the next step, not before.

## 9. Sketch of what still needs building (not started)

- `server/analytics/fieldRegistry.ts` — walks all 7 tab configs once,
  produces the `AnalyticsFieldMeta[]` the picker UI and the aggregation
  functions both read from (see types file).
- `server/analytics/derivedFields.ts` — `age`, `bmi`, gestational-age
  bucketing.
- `server/analytics/aggregate.ts` — implements the six branches in §2 plus
  time-series (§5), each returning one of the `AnalyticsResult` variants
  in the types file.
- API routes (admin-only): a fields-list endpoint for the picker, a
  cohort-summary endpoint, a time-series endpoint.
- UI: field/filter pickers sourced from the registry, a stats panel, and a
  chart chosen by the same decision table (recharts is already a
  dependency — bar/pie/scatter/line all covered, no new library needed).
  Likely `/admin/analytics` for cohort mode; time-series mode probably
  belongs closer to a patient's own record rather than as a separate page.

## 10. Open questions worth settling before implementation starts

1. Categorical × Categorical with an implied ratio measure (matrix in
   §2's last row) — the spec's wording is ambiguous about which cases
   want counts vs. per-group averages. Needs a concrete example from
   whoever owns the requirements.
2. Should `STANDARD_SEGMENTS.tsh` (and maybe `.bmi`) be
   hospital-configurable from day one, given they're clinically
   contestable, or is a hardcoded default acceptable for v1?
3. Minimum cell-count suppression threshold for privacy (§7) — is n<5 the
   right bar, or should it follow whatever policy this hospital already
   uses for its own reporting?
4. Where does time-series mode live in the nav — a tab on the patient
   record, or folded into the same `/admin/analytics` page as cohort mode?
