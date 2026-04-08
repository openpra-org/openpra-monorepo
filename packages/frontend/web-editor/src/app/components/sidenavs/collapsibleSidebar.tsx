import { useState } from "react";
import { EuiButtonIcon, useEuiTheme } from "@elastic/eui";
import { ScopedNav } from "./scopedNav";
import type { ScopedNavProps } from "./scopedNav";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 40;
const STORAGE_KEY = "web-editor:sidebar:collapsed";

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };

// ---------------------------------------------------------------------------
// Hook — shared collapse state backed by localStorage
// ---------------------------------------------------------------------------
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
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
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return { collapsed, toggle };
}

// ---------------------------------------------------------------------------
// Inner content — rendered INSIDE EuiPageTemplate.Sidebar (not wrapping it).
// Keeping the sidebar as a direct child of EuiPageTemplate is required so
// EuiPageTemplate's React.Children scan can detect it by type and apply the
// correct row-layout/sidebar logic.
// ---------------------------------------------------------------------------
interface SidebarContentProps {
  type: ScopedNavProps["type"];
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarContent({ type, collapsed, onToggle }: SidebarContentProps): JSX.Element {
  const { euiTheme } = useEuiTheme();

  return (
    // height: 100% works here because the parent EuiPageTemplate.Sidebar receives
    // style={{ height: "calc(100vh - var(--euiFixedHeadersOffset, 0))" }} from each
    // container, giving it an explicit height that propagates to children.
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Scrollable nav — hidden when collapsed */}
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

      {/* Fills the gap so the button stays at the bottom when nav is hidden */}
      {collapsed && <div style={{ flex: 1 }} />}

      {/* Toggle button — naturally at the bottom of the flex column */}
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
