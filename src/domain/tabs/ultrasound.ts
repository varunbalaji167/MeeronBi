import { GridSectionConfig, TabConfig } from "./types";
import { leftRightBoth, normalAbnormal, positiveNegative, yesNo } from "./sharedOptions";
import { weeksWindow } from "../gestationalAge";

// Per the source spec's page 4 ("Ultrasounds are mandatory except that
// specific ultrasounds are done in pre-specified time. Display based on
// LMP.", repeated per-section as "Auto select for display using LMP
// date"): several sections below carry a `recommendedWindow` — a textbook
// gestational-age range, shown as a live badge computed from the Personal
// tab's LMP (see GestationalWindowBadge / TabRecordView). This tab
// otherwise has NO `core` fields at all (nothing on this page carries a
// red dot, unlike Personal/History/Investigation) — its display-timing
// story is this LMP-window mechanism instead of the usual
// shown-by-default/customizable split.
export const ultrasoundTab: TabConfig = {
  key: "ultrasound",
  label: "Ultrasound",
  route: "ultrasound",
  sections: [
    {
      title: "NT Scan",
      columns: 4,
      // "A nuchal translucency (NT) scan is performed during the first
      // trimester of pregnancy, ideally between 11 weeks and 13 weeks and 6 days."
      recommendedWindow: weeksWindow(11, 0, 13, 6, "11w0d – 13w6d"),
      fields: [
        { name: "ntScanDate", label: "NT Scan on", type: "date" },
        { name: "crlMm", label: "81. CRL (mm)", type: "number", placeholder: "e.g., 0.9", validation: { min: 0, max: 100, message: "CRL should be between 0-100 mm." } },
        {
          name: "pogWeeksDays",
          label: "82. POG (Weeks and Days)",
          type: "number",
          placeholder: "e.g., 12.9",
          // Was free text; every other POG field on this tab (and the
          // gestational-age math in domain/gestationalAge.ts) treats this
          // as a number, so this one now matches.
          validation: { min: 0, max: 45, message: "POG should be between 0-45 weeks." },
        },
        { name: "ntMm", label: "83. NT (mm)", type: "number", placeholder: "e.g., 8.1", validation: { min: 0, max: 10, message: "NT should be between 0-10 mm." } },
        { name: "ntOtherFindings", label: "84. Other findings", type: "select", options: ["Normal", "Abnormal"] },
      ],
    },
    {
      title: "Anomaly Scan",
      columns: 4,
      // "An anomaly scan and Soft Markers are done during the
      // mid-pregnancy - 18 and 22 weeks of gestation."
      recommendedWindow: weeksWindow(18, 0, 22, 0, "18w0d – 22w0d"),
      fields: [
        { name: "anomalyScanDate", label: "Anomaly Scan", type: "date" },
        { name: "anomalyParamWeeks", label: "86. Parameter (in Weeks)", type: "number", placeholder: "e.g., 18" },
        { name: "placenta1", label: "87. Placenta", type: "select", options: ["Anterior", "Posterior", "Fundal", "Lateral", "Low-lying"] },
        { name: "placentaGrade1", label: "87a. Placenta Grade", type: "select", options: ["0", "I", "II", "III"] },
        { name: "afi1", label: "88. AFI", type: "number", placeholder: "e.g., 9", validation: { min: 0, max: 30, message: "AFI should be between 0-30." } },
        {
          name: "afiLevel1",
          label: "89. AFI Level",
          type: "number",
          placeholder: "e.g., 9",
          // Was free text — inconsistent with the same "AFI Level" concept
          // recorded again in the Growth Scan section below (afiLevel2,
          // already a number). Made consistent.
          validation: { min: 0, max: 30, message: "AFI level should be between 0-30." },
        },
      ],
    },
    {
      kind: "grid",
      title: "Soft Markers",
      recommendedWindow: weeksWindow(18, 0, 22, 0, "18w0d – 22w0d"),
      valueColumns: [
        { name: "presence", label: "Presence/Absence", type: "radio", options: positiveNegative },
        { name: "sizeLocation", label: "Size/Location", type: "text" },
      ],
      rows: [
        { name: "nft", label: "90. NFT (mm)" },
        { name: "nasalBone", label: "91. Nasal Bone (mm)" },
        { name: "eif", label: "92. EIF (mm)" },
        { name: "pelvicaliectasis", label: "93. Pelvicaliectasis" },
        { name: "choroidPlexusCyst", label: "94. Choroid plexus cyst" },
        { name: "echogenicBowel", label: "95. Echogenic bowel" },
        { name: "lateralVentriclesSize", label: "96. Lateral ventricles size" },
        { name: "singleUmbilicalArtery", label: "97. Single umbilical artery" },
      ],
    } as GridSectionConfig,
    {
      fields: [{ name: "otherSoftMarkers", label: "98. Other Soft Markers", type: "textarea" }],
    },
    {
      title: "Uterine Artery Doppler",
      columns: 4,
      // "A uterine artery Doppler test is typically performed during 11 to
      // 14 weeks or the second trimester (20 to 24 weeks) of pregnancy" —
      // two distinct textbook windows (not one continuous span — the gap
      // between them, ~15-19 weeks, isn't a recommended time for this
      // test), so both are passed through and "in window" is true for
      // either one.
      recommendedWindow: [weeksWindow(11, 0, 14, 0, "11w0d–14w0d"), weeksWindow(20, 0, 24, 0, "20w0d–24w0d")],
      fields: [
        { name: "uterineDopplerDate", label: "Test Done on", type: "date" },
        { name: "pulsatilityIndex", label: "100. Pulsatility index", type: "number", placeholder: "e.g., 2.9" },
        { name: "pulsatilitySide", label: "Side", type: "radio", options: leftRightBoth },
        { name: "diastolicNotch", label: "101. Diastolic Notch", type: "select", options: yesNo },
        { name: "diastolicNotchSide", label: "Side", type: "radio", options: leftRightBoth },
      ],
    },
    {
      columns: 4,
      title: "Growth Scan",
      fields: [
        { name: "liePosition", label: "102. Lie/Position", type: "select", options: ["Cephalic", "Breech", "Transverse", "Oblique"], core: true },
        { name: "placenta2", label: "103. Placenta", type: "select", options: ["Anterior", "Posterior", "Fundal", "Lateral", "Low-lying"] },
        { name: "placentaGrade2", label: "103a. Placenta Grade", type: "select", options: ["0", "I", "II", "III"] },
        { name: "afiLiquor", label: "104. AFI/Liquor", type: "number", placeholder: "e.g., 9", validation: { min: 0, max: 30, message: "AFI should be between 0-30." }, core: true },
        { name: "afiLevel2", label: "104a. AFI Level", type: "number", placeholder: "e.g., 53.18" },
        { name: "efwGms", label: "105. EFW (gms)", type: "number", placeholder: "e.g., 2500", validation: { min: 100, max: 6000, message: "EFW should be between 100-6000 g." }, core: true },
        { name: "growthRemarks", label: "106. Remarks", type: "textarea", core: true },
        { name: "dopplerDone", label: "107. Doppler Done?", type: "radio", options: yesNo },
      ],
    },
    {
      kind: "grid",
      title: "USG FWB Before Delivery — Doppler Test",
      // "USG FWB (fetal well-being ultrasound) before delivery is routinely
      // done between 36 and 38 weeks of pregnancy, though it can be
      // repeated closer to 40 weeks or weekly if there are specific medical
      // complications." — window shown as 36-40w to cover the routine case
      // without flagging a same-condition repeat scan as "off schedule".
      recommendedWindow: weeksWindow(36, 0, 40, 0, "36w0d – 40w0d (may repeat weekly near term)"),
      valueColumns: [
        { name: "normalAbnormal", label: "Normal/Abnormal", type: "radio", options: normalAbnormal },
        { name: "ri", label: "RI", type: "number" },
        { name: "pi", label: "PI", type: "number" },
        { name: "sd", label: "S/D", type: "number" },
      ],
      rows: [
        { name: "umbilicalArtery", label: "108. Umbilical artery" },
        { name: "middleCerebralArtery", label: "109. Middle cerebral artery" },
        { name: "descendingAorta", label: "110. Descending aorta" },
        { name: "uterineArteryRight", label: "111. Uterine artery right" },
        { name: "uterineArteryLeft", label: "112. Uterine artery left" },
      ],
    } as GridSectionConfig,
    {
      columns: 3,
      title: "Veins Velocity (cm/s)",
      fields: [
        { name: "umbilicalVeinsVelocity", label: "113. Umbilical Veins", type: "number", placeholder: "e.g., 15.12" },
        { name: "umbilicalVeinsStatus", label: "Status", type: "radio", options: normalAbnormal },
        { name: "infVenaCavaVelocity", label: "114. Inf. vena cava", type: "number", placeholder: "e.g., 11.12" },
        { name: "infVenaCavaStatus", label: "Status", type: "radio", options: normalAbnormal },
        { name: "ductusVenosusVelocity", label: "115. Ductos Venosus", type: "number", placeholder: "e.g., 53.18" },
        { name: "ductusVenosusStatus", label: "Status", type: "radio", options: normalAbnormal },
      ],
    },
    {
      fields: [{ name: "abnormalRemarks", label: "116. Abnormal remarks", type: "textarea" }],
    },
  ],
};
