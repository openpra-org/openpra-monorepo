import { JSX } from "react";
import "./css/kbd.css";

function Kbd({ children }: { children: string }): JSX.Element {
  return <span className="kbd">{children}</span>;
}

function KbdCombo({ keys, separator }: { keys: string[]; separator?: string }): JSX.Element {
  const sep = separator ?? "+";
  return (
    <span className="kbd-combo">
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="kbd-combo__part">
          {i > 0 && <span className="kbd-combo__sep">{sep}</span>}
          <Kbd>{k}</Kbd>
        </span>
      ))}
    </span>
  );
}

export { Kbd, KbdCombo };
