import { JSX } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "../welcome/icons";
import { type Theme } from "../welcome/useTheme";
import { SettingRow } from "./settingRow";
import { SegmentedControl } from "./segmentedControl";
import { Toggle } from "./toggle";
import type { AppearancePrefs } from "./useAppearancePrefs";

const THEME_OPTIONS: { id: Theme; label: string; icon: JSX.Element }[] = [
  { id: "light", label: "Light", icon: <SunIcon /> },
  { id: "dark", label: "Dark", icon: <MoonIcon /> },
  { id: "auto", label: "System", icon: <MonitorIcon /> },
];

const SIG_FIGS = [2, 3, 4, 5, 6, 7, 8];

function AppearanceSection({
  theme,
  setTheme,
  prefs,
  setReducedMotion,
  setHighContrast,
  setSigFigs,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  prefs: AppearancePrefs;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setSigFigs: (n: number) => void;
}): JSX.Element {
  return (
    <section id="appearance" className="pf__section st__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Appearance &amp; accessibility</h2>
        </div>
      </div>
      <div className="st__rows">
        <SettingRow
          label="Theme"
          control={
            <SegmentedControl
              ariaLabel="Theme"
              options={THEME_OPTIONS}
              value={theme}
              onChange={setTheme}
            />
          }
        />
        <SettingRow
          label="Reduce motion"
          description="Turn off non-essential animations."
          control={
            <Toggle
              checked={prefs.reducedMotion}
              onChange={setReducedMotion}
              label="Reduce motion"
            />
          }
        />
        <SettingRow
          label="High-contrast mode"
          description="Stronger borders and text for low-vision use."
          control={
            <Toggle
              checked={prefs.highContrast}
              onChange={setHighContrast}
              label="High contrast"
            />
          }
        />
        <SettingRow
          label="Number formatting"
          description="Significant figures for decimal and scientific notation in PRA results."
          control={
            <select
              className="st__select st__select--sm"
              value={prefs.sigFigs}
              onChange={(e) => { setSigFigs(Number(e.target.value)); }}
              aria-label="Significant figures"
            >
              {SIG_FIGS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          }
        />
      </div>
    </section>
  );
}

export { AppearanceSection };
