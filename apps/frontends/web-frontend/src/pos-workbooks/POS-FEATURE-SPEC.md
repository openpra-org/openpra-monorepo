# POS Workbook — Feature Spec (TODO)

Make the Plant Operating State (POS) workbook perform real Probabilistic Risk
Assessment, not just display example data. Grounded in the verified POS research
findings and the actual files in this folder.

**Status legend:** `[ ]` not started · `[~]` partial/exists-but-fake · `[x]` done.

---

## 0. Context — what already exists (do NOT rebuild)

- [x] MEF schema is comprehensive — `apps/interfaces/mef-types/pos/plant-operating-state-analysis.ts` (evolutions, states, screening, groups, decay-heat, validation rules, transitions, documentation).
- [x] Backend is live — `posWorkbookApi.ts` (persistence, roles, comments, workflow sign-offs, document upload/download, load/unload example).
- [x] Patch plumbing — `useMefPatch.ts` (`mefPatch` / `mefPatchDebounced`).
- [x] Read selectors — `posSelectors.ts` (views over the MEF document).
- [x] Step 01 Scope — fully controlled + patch-wired (plant identity, scope, stage, CC, at-power/LPSD/hazard toggles).
- [x] Step 02 Documents — upload/delete/download wired to backend (extraction intelligence is fake).
- [x] Step 10 Draft — real docx TOC + conformance scoring + submit-to-review.
- [x] Steps 11–12 Review/Approval — real comments + sign-off workflow.

**Core deficiency to fix:** Steps 03–09 only render pre-baked example data. The
one editor (the drawer) uses uncontrolled `defaultValue` inputs that never save.
There is no quantification and no physics. An analyst cannot author a POS today.

---

## 1. Design principles (apply to every task below)

- [ ] Schema-first — map to existing MEF fields; only add schema where physics demands it (see §11).
- [ ] Every editor is **controlled** and **patch-wired** via `mefPatchDebounced` / `mefPatch`. No `defaultValue`-only inputs anywhere.
- [ ] Derived fields are **computed, never typed** (duration fractions, coverage %, conditional probabilities, decay heat at t, time-to-boil).
- [ ] Conformance flips as a **side effect** of completing work (the dock chips already read `conformanceMatrix`).
- [ ] Repo conventions: JSX + CSS separated, no `any`/`never`/`unknown`, no regex, no eslint-disable, no inline comments, exact dependency pins.

---

## 2. Step 03 — Plant Evolutions (`PlantEvolution[]`)

Enumerate the representative plant evolutions. SR target: **POS-A1, A2, A6, A13**.

- [x] CRUD: add / edit / delete evolution ("Add evolution" → drawer in create mode).
- [x] Editor fields → `plantEvolutions[i]`: `name`, `type` (`EvolutionType` select), `description`, `operatingModes[]` (multi-select `OperatingMode`), `sourceDocumentRef`.
- [ ] POS-A2 evidence checklist — the 9 `reviewedDocumentation` sub-fields (operating modes / RCB configs / RCS ranges / decay-heat mechanisms / instrumentation / activities-leading-to-changes / barrier status / SSC capability changes / operational assumptions) as a checklist that drives A2 conformance.
- [ ] POS-A1 coverage banner — show which mandated evolution types are present (refueling outage, controlled shutdown, forced outage, at-power); warn on any missing.
- [ ] POS-A6 `futureEvolutionReview` (operating plants): higher-risk states not previously encountered / earlier-or-later entry decay-heat impacts / duration changes.
- [ ] POS-A13 pre-op assumptions sub-card.
- [x] Replace the "Add evolution — coming soon" stub in `posScreens.tsx`.

---

## 3. Step 04 — Operating States (`PlantOperatingState[]`) — THE HEART

Mutually-exclusive, collectively-exhaustive states with full attributes.
SR target: **POS-A3, A9, A11**. Convert the read-only drawer into a real,
controlled, patch-wired editor.

- [ ] CRUD: add / edit / delete state; replace "Add state — coming soon" stub.
- [ ] **Section 1 — Identity:** `name`, `evolutionId` (select), `operatingMode`, `description`, `rcbConfiguration`.
- [ ] **Section 2 — RCS parameters** (`ReactorCoolantSystemParameters`), each a `ParameterRange` (min / max / representative / units) editor:
  - [ ] `powerLevel`, `decayHeatLevel`, `reactorCoolantTemperature`, `coolantPressure`
  - [ ] optional `reactorLevel`, `coolantInventory`, `timeAfterShutdownHours`
  - [ ] `rcsConfigurationDescription` (free text)
  - [ ] extensible `otherParameters` map
- [ ] **Section 3 — Radioactive material sources** (`RadioactiveSource[]`): add/remove with location (in-core / ex-core), radionuclides, status, release paths, barriers, screening status. (Ex-core sources — spent fuel, cover gas — matter for non-LWR.)
- [ ] **Section 4 — Radionuclide transport barriers** (`RadionuclideTransportBarrier[]`): name + `BarrierStatus` + monitoring params + breach criteria; wire the broken-barrier highlight to live data.
- [ ] **Section 5 — Time boundary** (`TimeBoundary`): starting/ending condition + `transitionParameters[]` (parameter, threshold, units, monitored, instruments).
- [ ] **Section 6 — Decay-heat removal config** (`DecayHeatRemovalConfiguration`): primary / secondary / passive `Record<string, SystemStatus>` editors (YES / NO / STANDBY / OOS per train).
- [ ] **Section 7 — SSC operational characteristics** (`SscOperationalCharacteristic[]`) → POS-A11: SSC ref + desired state + supported safety-function category.
- [ ] **Section 8 — Safety functions** (`SafetyFunction[]`): category, success/failure criteria, success-criteria IDs, implementation mechanisms, supporting SSCs, applicable initiating events.
- [ ] **Section 9 — Available instrumentation** (`Instrument[]`): per-state monitoring set.
- [ ] **Section 10 — Pre-op assumptions** per state → POS-A13.
- [ ] Remove all uncontrolled `defaultValue` inputs from `posDrawer.tsx`; every field calls patch.

---

## 4. Step 05 — Interviews & Walkdowns (`InterviewRecord[]`)

Evidence for **POS-A7** (operating) / **POS-A8** (pre-operational).

- [ ] CRUD a session: `date`, `method` (tabletop / walkdown / computerized-walkdown / interview), `personnelRoles[]`, `findings`, `evolutionId`/`posId` link.
- [ ] `overlookedEvolutionsIdentified[]` — link a surfaced missing evolution back so it can be added in Step 03 (closes the A7/A8 loop).
- [ ] Wire the "N new states identified" badge to the array length.
- [ ] Replace "Log session — coming soon" stub.

---

## 5. Step 06 — Screening (`PosScreeningRecord[]`, `SubsumedPosRecord[]`, `PosSeparationRecord[]`, `DemandTimeBasedRecord[]`)

Screen-then-detail workflow. SR target: **POS-B2, B4, B5**. Replace the hardcoded
`posId === "POS-05"` risk-impact logic.

- [ ] Per-state screening decision: retained vs screened-out; if screened pick `criterion` (`SCR-1/2/3/ALTERNATE`), `quantitativeBasis?`, `justification`, `alternateCriterionJustification?` (when ALTERNATE) → POS-B2.
- [ ] Subsumption records (`SubsumedPosRecord`): subsumed→subsuming mapping, criterion, risk impact (`ImportanceLevel`), limitations, validation method, optional `SensitivityStudy`.
- [ ] Demand-vs-time-based separation (`DemandTimeBasedRecord[]`) → POS-B5 (avoid averaging short demands).
- [ ] Separation records (`PosSeparationRecord[]`) → POS-B4 (different response / higher release kept separate).
- [ ] Replace "Propose screening — coming soon" stub.

---

## 6. Step 07 — Grouping (`PlantOperatingStateGroup[]`, `EvolutionGroup[]`)

Group similar POSs without masking risk. SR target: **POS-B1, B3, B6**.

- [ ] Group builder: create group, assign member POS IDs, enter `similarityBasis`, `boundingCharacteristics[]`, `evolutionType`, `doesNotMaskRiskSignificantContributors` attestation → POS-B3.
- [ ] POS-B6 bounding rule: show members' attributes side by side; auto-suggest the most severe/constraining value per attribute (lowest time-to-boil, highest decay heat, most-degraded barrier) as the group bounding characteristic; analyst confirms.
- [ ] `summedDurationHours` auto-computed from members.
- [ ] `entryFrequency` rolled up per POS-B1 / C3.
- [ ] Evolution-level grouping (`EvolutionGroup`) for the coarser roll-up.
- [ ] Make the grouping drawer controlled; replace "Propose group — coming soon" stub.

---

## 7. Step 08 — Frequencies & Duration (quantification)

The quantitative inputs IE analysis multiplies. SR target: **POS-C1, C2, C3**.
Make the expand-row editor real (today `defaultValue`-only, "Basis" hardcoded `—`).

- [ ] Per state, controlled inputs: `meanDurationHours`, `meanTimeAfterShutdownHours`, `meanEntryFrequency` (scalar `Frequency` AND `FrequencyWithDistribution`), `durationAndCycleTimingBasis` (the hardcoded "Basis" column) → POS-C1, C2.
- [ ] Computed, read-only — duration fraction = state hours ÷ Σ all-state hours.
- [ ] Computed, read-only — conditional probability of an initiator in this POS = initiator rate × POS duration.
- [ ] Computed, read-only — IE-frequency preview = POS entry frequency × conditional probability (research's exact formula; POS emits, IE multiplies).
- [ ] Cycle-time reconciliation — Σ POS durations vs total cycle hours with a delta indicator.
- [ ] Group durations summed and checked against members → POS-C3.

---

## 8. Step 09 — Decay Heat (`DecayHeatCharacterization[]`) — THE PHYSICS

Per-LPSD-state decay heat and the operator-timing it drives. SR target: **POS-C4**.
Today 100% stubbed (columns hardcoded `—` / "Pending vendor curve fit").

- [ ] Per LPSD state: `timeAfterShutdownHours`, `decayHeatLevel` (`ParameterRange`, MW), `basis`, `isLpsd`.
- [ ] Decay-heat curve fit (computation): ingest the vendor decay-heat curve (document from Step 02), evaluate decay power at each state's time-after-shutdown.
  - [ ] DECISION AREA — the correlation representing decay heat vs. time after shutdown. Survey the full space of standard correlations and plant-specific fits before fixing one. Default: vendor curve when supplied. (Do not pre-enumerate candidates in code.)
- [ ] Time-to-boil / heatup rate (computed): from coolant inventory/mass, heat capacity, current temperature, saturation temperature, and decay power. (Frames HRA operator-action credit — see §11 schema gap.)
- [ ] Time-window layer (`timeVaryingConditions[]`): one POS carries multiple decay-heat windows (e.g. 1–3 d, 3–5 d), each with representative decay power and success-criteria implication (research's "time-window approach").
- [ ] Replace "Generate from curves — coming soon" stub.

---

## 9. Cross-cutting — Computation layer (`posCompute.ts`, new pure module)

Pure, no React, fully unit-testable. Derives everything currently faked.

- [ ] Cycle-time normalization + per-evolution/per-state duration fractions.
- [ ] Conditional-probability and IE-frequency preview (POS freq × rate × duration).
- [ ] Group duration/frequency roll-ups with bounding-attribute selection.
- [ ] Decay-heat evaluation at time t.
- [ ] Time-to-boil from thermal inputs + decay power.
- [ ] Unit tests for each function.

---

## 10. Cross-cutting — Validation engine (drives Step 04 "Coverage check")

Today `validationRules` is stored; it must be computed.

- [ ] Mutual exclusivity (`MutualExclusivityValidation`): every plant condition maps to exactly one POS along the chosen `delineationParameters`; surface overlaps.
- [ ] Collective exhaustivity (`CollectiveExhaustivityValidation`): Σ POS hours ÷ total cycle hours → `coverageFraction`; flag gaps.
- [ ] Transition validation (`TransitionValidation` + `TransitionEvent[]`): build the POS transition matrix; verify every state is reachable and exitable.

---

## 11. Cross-cutting — Downstream handoff bundle (SR-dependency mapping, made tangible)

Read-only "Interfaces / handoff" view exporting, per retained POS/group, what each
downstream element consumes (already modeled on each `PlantOperatingState`). Makes
the existing `WorkbookInterfaceMap` data-backed rather than decorative.

- [ ] → IE: `applicableInitiatingEvents`, entry frequency, duration.
- [ ] → SC: `successCriteriaIds`, decay-heat level, time-to-boil.
- [ ] → SY: `decayHeatRemoval` config, available trains, `sscOperationalCharacteristics`.
- [ ] → HRA: time-to-boil / time-window timing.

---

## 12. Genuine schema additions to propose (the only gaps)

Everything else has a home in the schema. These do not yet.

- [ ] Decay-heat curve representation — structured fit/curve object (parameters of the chosen correlation) so decay power at arbitrary t is computable, not just point values.
- [ ] Time-to-boil / heatup-rate field on `PlantOperatingState` (or `TimeVaryingCondition`) alongside `decayHeatLevel`.
- [ ] Thermal inputs for time-to-boil — coolant mass / heat capacity / saturation temperature (some derivable from `coolantInventory`; heat capacity and saturation T are not yet first-class).

---

## 13. Suggested build order

- [ ] 1. Step 04 state editor (controlled + patch-wired) — unblocks everything.
- [ ] 2. Step 03 evolutions CRUD — states need parent evolutions.
- [ ] 3. Validation engine + Step 04 coverage — mutual-exclusivity / exhaustivity computed.
- [ ] 4. Step 08 quantification — durations / frequencies + IE-frequency preview.
- [ ] 5. Step 09 decay heat + time-to-boil (with §12 schema additions).
- [ ] 6. Steps 06–07 screening & grouping with real bounding logic.
- [ ] 7. Step 05 interviews, then §11 handoff bundle.

---

## Sources (verified research)

NUREG/CR-6144 (Surry LPSD, Vols. 1 & 6), NUREG/CR-7265 Vol. 1 (PIRT), OSTI/INL
974755 (SPAR BWR shutdown), PSAM12 paper 45, ASME/ANS RA-S-1.4-2021 (HLR-POS-A/B/C,
SR POS-A1/A3/B3 verified via ADAMS ML25211A351), Westinghouse LPSD PRA data sheet.
