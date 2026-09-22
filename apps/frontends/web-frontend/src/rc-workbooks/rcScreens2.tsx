import { JSX } from "react";
import { useRcWorkbook } from "./rcWorkbookContext";
import { type RcDrawerContext } from "./rcScreens";
import { RcDosePanel } from "./rcDoseInputs";
import { RcHealthPanel } from "./rcHealthInputs";
import { RcEconomicsPanel } from "./rcEconomics";
import { RcTransportPanel } from "./rcTransport";

// ─── 04 — Atmospheric Dispersion (RCAD) ────────────────────────────────────
function DispersionScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  return <RcTransportPanel openEditor={kind => openDrawer({ kind, id: kind })} />;
}

// ─── 05 — Dosimetry (RCDO) ─────────────────────────────────────────────────
function DosimetryScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, mutateRc } = useRcWorkbook();
  const dose = rc.dosimetry;
  function addPathway(): void {
    const options = ["CLOUDSHINE", "GROUNDSHINE", "SKIN_DEPOSITION", "INHALATION", "INGESTION"] as const;
    const pathway = options.find(value => !dose.exposurePathways.some(item => item.pathway === value));
    if (!pathway) return;
    mutateRc((draft) => ({ ...draft, dosimetry: { ...draft.dosimetry, exposurePathways: [...draft.dosimetry.exposurePathways, { pathway, included: true }] } }));
    openDrawer({ kind: "pathway", id: String(dose.exposurePathways.length) });
  }
  return <RcDosePanel
    onAddPathway={addPathway}
    canAddPathway={dose.exposurePathways.length < 5}
    onEditPathway={index => openDrawer({ kind: "pathway", id: String(index) })}
    onEditTreatment={() => openDrawer({ kind: "dosetreatment", id: "dose" })}
  />;
}

// ─── 06 — Health Effects (RCHE) ────────────────────────────────────────────
function HealthEffectsScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  return <RcHealthPanel openEditor={(kind, id) => openDrawer({ kind, id })} />;
}

// ─── 07 — Economic Factors (RCEC) ──────────────────────────────────────────
function EconomicsScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  return <RcEconomicsPanel openEditor={(kind, id) => openDrawer({ kind, id })} />;
}

export { DispersionScreen, DosimetryScreen, HealthEffectsScreen, EconomicsScreen };
