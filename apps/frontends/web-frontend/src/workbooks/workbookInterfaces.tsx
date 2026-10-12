import { JSX } from "react";
import { type ElementCode, dockDependenciesForSr } from "./elementDependencies";
import "./css/workbookInterfaces.css";

function DockDependsChip({ element, sr }: { element: ElementCode; sr: string }): JSX.Element | null {
  const deps = dockDependenciesForSr(element, sr);
  if (deps.length === 0) return null;
  const hlrs = deps.flatMap((d) => d.hlrs);
  return (
    <span className="posdock__item-depends">
      <span className="posdock__item-depends-label">Needs</span>
      {hlrs.map((h) => <span key={h} className="posdock__item-depends-hlr">{h}</span>)}
    </span>
  );
}

export { DockDependsChip };
