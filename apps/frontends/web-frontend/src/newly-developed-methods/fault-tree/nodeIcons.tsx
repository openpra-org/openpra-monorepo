import { JSX } from "react";
import { type FtNodeData } from "./faultTreeTypes";

const SYMBOLS: Record<string, JSX.Element> = {
  AND: <path d="M4 20 L4 11 A 8 8 0 0 1 20 11 L 20 20 Z" />,
  OR: <path d="M4 20 Q 12 16 20 20 Q 20 8 12 3 Q 4 8 4 20 Z" />,
  NOT: (
    <>
      <path d="M5 5 L19 5 L12 17 Z" />
      <circle cx="12" cy="19.4" r="2" />
    </>
  ),
  ATLEAST: <path d="M7 4 L17 4 L21 12 L17 20 L7 20 L3 12 Z" />,
  BASIC: <circle cx="12" cy="12" r="9" />,
  HOUSE: <path d="M4 20 L4 10 L12 4 L20 10 L20 20 Z" />,
  TRANSFER: <path d="M12 4 L21 20 L3 20 Z" />,
  UNDEVELOPED: <path d="M12 3 L21 12 L12 21 L3 12 Z" />,
};

function symbolKey(data: FtNodeData): string {
  if (data.type === "GATE") return data.gate ?? "OR";
  return data.type;
}

export function GateIcon({ data }: { data: FtNodeData }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="ftnode__symbol-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      {SYMBOLS[symbolKey(data)] ?? SYMBOLS.OR}
    </svg>
  );
}
