import { useState } from "react";
import { EuiButtonIcon, useEuiTheme } from "@elastic/eui";
import { ScopedNav } from "./scopedNav";
import type { ScopedNavProps } from "./scopedNav";
const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 40;
const STORAGE_KEY = "web-editor:sidebar:collapsed";
export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggle: () => void;
} {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const toggle = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };
  return { collapsed, toggle };
}
interface SidebarContentProps {
  type: ScopedNavProps["type"];
  collapsed: boolean;
  onToggle: () => void;
}
export function SidebarContent({ type, collapsed, onToggle }: SidebarContentProps): JSX.Element {
  const { euiTheme } = useEuiTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          overflowX: "hidden",
          padding: collapsed ? 0 : euiTheme.size.s,
          display: collapsed ? "none" : undefined,
        }}
      >
        <ScopedNav
          type={type}
          variant="sidenav"
        />
      </div>

      {collapsed && <div style={{ flex: 1 }} />}

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-end",
          padding: euiTheme.size.xs,
          borderTop: `1px solid ${euiTheme.border.color}`,
        }}
      >
        <EuiButtonIcon
          iconType={collapsed ? "arrowRight" : "arrowLeft"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
          size="s"
          color="text"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        />
      </div>
    </div>
  );
}
