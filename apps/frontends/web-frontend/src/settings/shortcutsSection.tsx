import { JSX } from "react";
import { KbdCombo } from "./kbd";
import "./css/shortcutsSection.css";

interface Shortcut {
  label: string;
  combos: string[][];
  multi?: boolean;
}

const EDITOR_SHORTCUTS: Shortcut[] = [
  { label: "Save current model", combos: [["⌘", "S"]] },
  { label: "Undo / Redo", combos: [["⌘", "Z"], ["⌘", "⇧", "Z"]], multi: true },
  { label: "Insert basic event", combos: [["B"]] },
  { label: "Insert AND gate", combos: [["A"]] },
  { label: "Insert OR gate", combos: [["O"]] },
  { label: "Insert house event", combos: [["H"]] },
  { label: "Delete selection", combos: [["⌫"]] },
];

const ANALYSIS_SHORTCUTS: Shortcut[] = [
  { label: "Quantify model", combos: [["⌘", "↵"]] },
  { label: "Stop running analysis", combos: [["⌘", "."]] },
];

function ShortcutGroup({ title, items }: { title: string; items: Shortcut[] }): JSX.Element {
  return (
    <div className="st__kbd-group">
      <h3 className="st__kbd-group-title">{title}</h3>
      <ul className="st__kbd-list">
        {items.map((row) => (
          <li key={row.label} className="st__kbd-row">
            <span className="st__kbd-label">{row.label}</span>
            <span className="st__kbd-combos">
              {row.combos.map((combo, i) => (
                <span key={`${row.label}-${i}`} className="st__kbd-combo-wrap">
                  {i > 0 && <span className="st__kbd-then">then</span>}
                  <KbdCombo keys={combo} />
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShortcutsSection(): JSX.Element {
  return (
    <section id="shortcuts" className="pf__section st__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Keyboard shortcuts</h2>
        </div>
      </div>
      <div className="st__kbd-groups">
        <ShortcutGroup title="Editor" items={EDITOR_SHORTCUTS} />
        <ShortcutGroup title="Analysis" items={ANALYSIS_SHORTCUTS} />
      </div>
    </section>
  );
}

export { ShortcutsSection };
