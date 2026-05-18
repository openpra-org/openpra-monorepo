import { JSX } from "react";
import { SettingRow } from "./settingRow";
import type { Approximation, Engine, WorkspaceDefaults } from "./useWorkspaceDefaults";

const ENGINES: { id: Engine; label: string }[] = [
  { id: "scram", label: "SCRAM (open-source, BDD)" },
  { id: "saphire", label: "SAPHIRE-compatible" },
  { id: "openpra", label: "OpenPRA built-in (MOCUS)" },
];

const APPROXIMATIONS: { id: Approximation; label: string }[] = [
  { id: "rare-event", label: "Rare-event" },
  { id: "mcub", label: "Min cut upper bound (MCUB)" },
  { id: "exact", label: "Exact (BDD)" },
];

function WorkspaceSection({
  defaults,
  setEngine,
  setApproximation,
  setTruncation,
}: {
  defaults: WorkspaceDefaults;
  setEngine: (e: Engine) => void;
  setApproximation: (a: Approximation) => void;
  setTruncation: (t: string) => void;
}): JSX.Element {
  return (
    <section id="workspace" className="pf__section st__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Workspace defaults</h2>
          <p className="pf__section-sub">Applied to new projects. Each project can override these.</p>
        </div>
      </div>
      <div className="st__rows">
        <SettingRow
          label="Default quantification engine"
          description="Used for new projects unless overridden."
          control={
            <select
              className="st__select"
              value={defaults.engine}
              onChange={(e) => { setEngine(e.target.value as Engine); }}
              aria-label="Default quantification engine"
            >
              {ENGINES.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          }
        />
        <SettingRow
          label="Approximation"
          description="Cut-set evaluation method."
          control={
            <select
              className="st__select"
              value={defaults.approximation}
              onChange={(e) => { setApproximation(e.target.value as Approximation); }}
              aria-label="Approximation"
            >
              {APPROXIMATIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          }
        />
        <SettingRow
          label="Truncation cutoff"
          description="Cut sets below this probability are dropped."
          control={
            <input
              type="text"
              className="field__input st__mono-input"
              value={defaults.truncation}
              onChange={(e) => { setTruncation(e.target.value); }}
              aria-label="Truncation cutoff"
            />
          }
        />
      </div>
    </section>
  );
}

export { WorkspaceSection };
