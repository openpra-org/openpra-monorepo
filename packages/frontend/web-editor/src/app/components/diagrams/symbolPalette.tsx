import { useState, DragEvent } from "react";
import { EuiFieldSearch, EuiText, EuiSpacer } from "@elastic/eui";
import { PALETTE_SYMBOLS, PaletteSymbol, SymbolShape } from "./pidSymbols";
import type { PidSymbolType } from "shared-sdk/lib/api/PlantDiagramApiManager";
const GROUPS = ["Equipment", "Valves", "Instruments", "Annotation"] as const;
export type DragPayload = {
  symbolType: PidSymbolType;
  instrumentCode: string;
  label: string;
};
interface SymbolPaletteProps {
  onDragStart: (event: DragEvent<HTMLDivElement>, payload: DragPayload) => void;
}
function PaletteItem({
  sym,
  onDragStart,
}: {
  sym: PaletteSymbol;
  onDragStart: SymbolPaletteProps["onDragStart"];
}): JSX.Element {
  const payload: DragPayload = {
    symbolType: sym.symbolType,
    instrumentCode: sym.defaultInstrumentCode ?? "",
    label: sym.label,
  };
  return (
    <div
      draggable
      onDragStart={(e): void => {
        onDragStart(e, payload);
      }}
      title={sym.label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        borderRadius: 4,
        cursor: "grab",
        userSelect: "none",
      }}
      onMouseEnter={(e): void => {
        (e.currentTarget as HTMLDivElement).style.background = "#eef2ff";
      }}
      onMouseLeave={(e): void => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <svg
        viewBox="0 0 40 40"
        width={28}
        height={28}
        style={{
          flexShrink: 0,
          color: "#1a1a2e",
          overflow: "visible",
        }}
      >
        <SymbolShape
          symbolType={sym.symbolType}
          instrumentCode={sym.defaultInstrumentCode ?? "XI"}
        />
      </svg>

      <span
        style={{
          fontSize: 12,
          color: "#343741",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sym.label}
      </span>
    </div>
  );
}
export function SymbolPalette({ onDragStart }: SymbolPaletteProps): JSX.Element {
  const [query, setQuery] = useState("");
  const filtered =
    query.trim() ? PALETTE_SYMBOLS.filter((s) => s.label.toLowerCase().includes(query.toLowerCase())) : PALETTE_SYMBOLS;
  return (
    <div
      style={{
        width: 230,
        flexShrink: 0,
        borderRight: "1px solid #d3dae6",
        overflowY: "auto",
        padding: "8px 4px",
        background: "#fafbfd",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ padding: "0 4px 6px" }}>
        <EuiFieldSearch
          placeholder="Search symbols…"
          value={query}
          onChange={(e): void => {
            setQuery(e.target.value);
          }}
          compressed
        />
      </div>

      {GROUPS.map((group) => {
        const items = filtered.filter((s) => s.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <div
              style={{
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 700,
                color: "#69707d",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderTop: "1px solid #eef0f3",
                marginTop: 4,
              }}
            >
              {group}
            </div>
            {items.map((sym, i) => (
              <PaletteItem
                key={`${sym.symbolType}-${i}`}
                sym={sym}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        );
      })}

      <EuiSpacer size="s" />
      <EuiText
        size="xs"
        color="subdued"
        style={{ padding: "0 8px" }}
      >
        <p>Drag symbols onto the canvas. Connect them by dragging between handles.</p>
      </EuiText>
    </div>
  );
}
