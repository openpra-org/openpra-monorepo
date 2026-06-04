import { JSX } from "react";

function Badge({ kind, children }: { kind?: string; children: React.ReactNode }): JSX.Element {
  return (
    <span className={"posbadge" + (kind !== undefined ? ` posbadge--${kind}` : "")}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

export { Badge };
