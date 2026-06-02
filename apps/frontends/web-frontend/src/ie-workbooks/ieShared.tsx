import { JSX, ReactNode } from "react";

type BadgeKind = "ok" | "draft" | "progress" | "warn" | "block" | "na";

function Badge({ kind = "draft", children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge posbadge--${kind}`}>
      <span className="posbadge__dot" />
      <span>{children}</span>
    </span>
  );
}

export { Badge, type BadgeKind };
