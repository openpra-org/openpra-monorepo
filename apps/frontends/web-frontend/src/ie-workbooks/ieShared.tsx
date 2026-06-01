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

type StatKind = "warn" | "block" | "ok";

function Stat({ num, cap, sub, kind }: { num: ReactNode; cap: string; sub?: string; kind?: StatKind }): JSX.Element {
  return (
    <div className={`posstat${kind ? ` posstat--${kind}` : ""}`}>
      <div className="posstat__num">{num}</div>
      <div className="posstat__cap">{cap}</div>
      {sub !== undefined && <div className="posstat__sub">{sub}</div>}
    </div>
  );
}

export { Badge, Stat, type BadgeKind, type StatKind };
