# Analytics — design reference

Status: **implemented**. This document is the design record the shipped
feature was built against — read it for the *why* behind the decision
matrix, field classification, and disclosure-control rules; read the code
(`src/domain/analytics/`, `src/server/analytics/`, `src/components/analytics/`)
for current behavior.

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
| `multiselect` | Categorical, **exploded into one boolean sub-field per option** — a patient can have more than one condition selected, so a plain "count per value" would let percentages exceed 100%. Not addressed by the source spec; this is the cleanest fix. Resolution rule (`resolveValue.ts`): the field being **absent** (never asked) resolves to `null`, dropped from the denominator; **present but not including this option** resolves to `"No"`, keeping "% Yes" a share of patients actually asked, not of the whole cohort. |
| `date` | Not directly analyzable. Feeds derived ratio fields (Age, gestational age) or serves as the time axis in time-series mode — never appears in the Field/Filter picker itself. |
| `text`, `textarea`, `phone`, `time` | Excluded from the picker (free text isn't summarizable this way; phone is PII) |

Fields living inside a **grid or repeating section** (Investigation's
Thyroid/ECHO grids, Treatments' visit rows, History's Obstetric History)
are flagged `multiValue: true` — a patient can have more than one entry, so
they're only eligible for **time-series mode**, not the simple cohort
single-value path, until bucketed by trimester (see §5).

**Two implementation-level exclusions in `fieldRegistry.ts`**, both
narrower than the table above:

- **"Gestational age at this entry" companion columns** (Investigation's
  Thyroid grid, Treatments' measurements/courses — `gestAgeWeeks`,
  `pogWeeks`) exist only to date their row, the same job a `date` column
  does. They're excluded from the registry entirely rather than showing up
  as always-empty, circular time-series fields.
- **A grid/repeating section with no `date`-typed column at all**
  (Investigation's Reactive Tests/ECHO Findings, Ultrasound's Doppler grid)
  can never resolve a time-series point — its fields are treated as
  ordinary (non-`multiValue`) fields instead, making them cohort-eligible
  (e.g. "% HIV positive"). Left deliberately untouched: Treatments'
  "courses" and History's Obstetric History both have a real date and pass
  this check despite being debatable time-series candidates (courses rows
  are different drugs; Obstetric History's date is a past pregnancy's) —
  not resolved here, see open question below.

Open question: should "courses" and Obstetric History be excluded from
time-series mode on top of the date check above? No concrete example yet
of a chart that would meaningfully use either as a trend.

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

**Shipped as designed:** `docs/SCALING_PLAN.md`'s security section has the
fuller three-tier design (hardened public page / authenticated
`RESEARCHER` role with disclosure controls / differential privacy as a
later upgrade). This module's routes are gated by `requireAnalyticsSession`
(`server/auth/guards.ts`, allows `ADMIN`/`SUPER_ADMIN`/approved
`RESEARCHER`), and every cohort/time-series branch runs its output through
`disclosureControl.ts` before it reaches the response — not left to the
caller's judgment.

### Disclosure-control shape decisions in `aggregate.ts`

- **`ratioSummary` has no `suppressed` flag** (unlike `CategoricalBreakdown`/
  `CrossTabCell`), so a below-threshold result comes back as
  `centralTendencies([])` (all-zero/null) with empty `buckets` —
  indistinguishable from "no data at all." The UI is expected to treat an
  all-zero `ratioSummary` as "not enough data," not "confirmed zero."
- **`ratioScatter`**: `ScatterPoint` carries no `patientId` by design, so
  the only disclosure control available is all-or-nothing on the whole
  plot — below threshold, every point is dropped, not a subset.
- **`ratioByCategory`**: groups below threshold are dropped outright, not
  merged into an "Other" bucket — central-tendency stats can't be combined
  the way a count can.
- **`categoryByCategory`/`categoryByRatio`** share one `crossTab()` helper
  so percentages stay consistent between the two branches (each cell's
  percent is of its own filter-group total, not the whole cohort).

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

## 9. Where each piece lives

- `src/domain/analytics/fieldRegistry.ts` — walks all 7 tab configs once,
  produces the `AnalyticsFieldMeta[]` the picker UI and the aggregation
  functions both read from (see `types.ts`).
- `src/domain/analytics/derivedFields.ts` — `age`, `bmi`, gestational-age
  bucketing.
- `src/server/analytics/aggregate.ts` — the six branches in §2 plus
  time-series (§5), each returning one of the `AnalyticsResult` variants
  in `types.ts`.
- `src/app/api/analytics/{fields,cohort,timeseries}/route.ts` — the
  researcher-facing endpoints (fields-list, cohort-summary, time-series).
- `src/components/analytics/` — field/filter pickers, stats panels, and
  chart components (`ResultChart`, `TimeSeriesChart`), surfaced at
  `/admin/analytics`; time-series mode is a panel within the same
  workbench rather than a separate patient-record tab.

## 10. Open questions — resolved

1. Categorical × Categorical with an implied ratio measure: shipped as
   counts only (`categoryByCategory`/`categoryByRatio` in `aggregate.ts`)
   — no per-group-average variant was built for this pairing.
2. `STANDARD_SEGMENTS.tsh`/`.bmi` hospital-configurability: not done for
   v1 — still a hardcoded default. Revisit if a second facility's clinical
   staff need different bands.
3. Minimum cell-count suppression threshold: `MIN_CELL_SIZE` in
   `domain/analytics/disclosureControl.ts` — 5 for internal/researcher
   audiences, 10 for public.
4. Time-series mode's nav placement: folded into `/admin/analytics`
   (`TimeSeriesPanel.tsx`), not a separate patient-record tab.
