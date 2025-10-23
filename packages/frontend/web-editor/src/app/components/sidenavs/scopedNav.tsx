import {
  EuiTreeView,
  EuiToken,
  useEuiTheme,
  EuiText,
  EuiCollapsibleNavGroup,
  useEuiPaddingSize,
  EuiSideNav,
} from "@elastic/eui";
import type { EuiTreeViewProps, EuiSideNavProps } from "@elastic/eui";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_BY_SCOPE } from "./navConfig";
import type { NavNode, ScopedNavScope } from "./types";
import { useEffect, useMemo, useState } from "react";

interface TreeItem {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  icon?: JSX.Element;
  iconType?: string;
  callback?: () => void;
}

export interface ScopedNavProps {
  type: string;
  /** optional: try the new EuiSideNav renderer without changing existing UI */
  variant?: "legacy" | "sidenav";
}

function ScopedNav(props: ScopedNavProps): JSX.Element {
  const { type, variant = "sidenav" } = props;

  const { euiTheme } = useEuiTheme();
  const location = useLocation();

  const createTreeItem = (label: string, data = {}, depth = 0): TreeItem => {
    let size: "xs" | "s" | "m" | "relative" = "relative";
    let text;
    let color: string;
    switch (depth) {
      case 0:
        text = <h5 style={{ textTransform: "uppercase" }}>{label}</h5>;
        color = "primary";
        break;
      case 1:
        size = "s";
        text = <h6>{label}</h6>;
        color = euiTheme.colors.darkestShade;
        break;
      default:
        size = "xs";
        text = label;
        color = "primary";
        break;
    }
    return {
      id: (data as { id?: string }).id ?? label,
      key: (data as { id?: string }).id ?? label,
      label: (
        <EuiText
          size={size}
          color={color}
          title={label}
        >
          {text}
        </EuiText>
      ),
      ...data,
    };
  };

  const navigate = useNavigate();
  const nodeToTreeItem = (node: NavNode, depth = 0): TreeItem => {
    const data: Partial<TreeItem> & { id: string } = {
      id: node.id,
      // Default: collapsed for legacy tree as well
      isExpanded: depth === 0 ? false : undefined,
      iconType: depth === 0 ? node.iconType : undefined,
      icon: depth > 0 && node.iconType ? <EuiToken iconType={node.iconType} /> : undefined,
      callback: node.path
        ? () => {
            void navigate(node.path!);
          }
        : undefined,
      children: node.items?.map((c) => nodeToTreeItem(c, depth + 1)),
    };
    return createTreeItem(node.name, data, depth);
  };

  const padding = useEuiPaddingSize("s");

  type SideNavItem = {
    id: string;
    name: string | React.ReactNode;
    href?: string;
    items?: SideNavItem[];
    isSelected?: boolean;
    isOpen?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    iconType?: string;
  };

  const createTreeView = (items: TreeItem[], i: number, forceTreeView = false): JSX.Element => {
    if (forceTreeView) {
      const style = {
        borderWidth: euiTheme.border.width.thin,
        borderRadius: euiTheme.border.radius.medium,
        borderColor: euiTheme.border.color,
        padding: padding,
      };
      return (
        <div style={style}>
          <EuiTreeView
            items={items as unknown as EuiTreeViewProps["items"]}
            key={i}
            aria-label="Model Sidebar"
            expandByDefault={false}
            showExpansionArrows
          />
        </div>
      );
    }

    const getIconType = (icon?: JSX.Element): string | undefined => {
      if (!icon) return undefined;
      const props = (icon as React.ReactElement).props as { type?: unknown; iconType?: unknown };
      const t = props.type;
      if (typeof t === "string") return t;
      const it = props.iconType;
      if (typeof it === "string") return it;
      return undefined;
    };

    if (!items[0].children) {
      return (
        <EuiCollapsibleNavGroup
          title={items[0].label}
          iconType={items[0].iconType ?? getIconType(items[0].icon)}
          iconSize="m"
          titleSize="xs"
          key={i}
          isCollapsible={true}
          isDisabled={false}
          arrowDisplay="none"
          onClick={items[0].callback}
        />
      );
    }

    return (
      <EuiCollapsibleNavGroup
        title={items[0].label}
        iconType={items[0].iconType ?? getIconType(items[0].icon)}
        iconSize="m"
        titleSize="xs"
        key={i}
        isCollapsible={true}
        buttonElement="button"
        initialIsOpen={items[0].isExpanded}
      >
        {createTreeView(items[0].children, i + 100, true)}
      </EuiCollapsibleNavGroup>
    );
  };

  const scope = (type as ScopedNavScope) in NAV_BY_SCOPE ? (type as ScopedNavScope) : "InternalEvents";
  const treeItems = (NAV_BY_SCOPE[scope] ?? []).map((n) => [nodeToTreeItem(n)]);

  if (variant === "sidenav") {
    // Persist expanded state per scope in localStorage
    const storageKey = useMemo(() => `web-editor:scopedNav:open:${scope}`, [scope]);
    const [openIds, setOpenIds] = useState<Set<string>>(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return new Set<string>();
        const arr = JSON.parse(raw) as string[];
        return new Set<string>(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set<string>();
      }
    });
    const hadStorage = useMemo(() => {
      try {
        return localStorage.getItem(storageKey) !== null;
      } catch {
        return false;
      }
    }, [storageKey]);

    // Update storage when openIds change
    useEffect(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(openIds)));
      } catch {
        // ignore storage failures
      }
    }, [openIds, storageKey]);

    const toggleOpen = (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    // Ensure ancestors of selected route are open and persisted
    useEffect(() => {
      const collectOpenAncestors = (nodes: NavNode[], pathname: string, includeDefaults: boolean): Set<string> => {
        const ids = new Set<string>();
        const visit = (node: NavNode): boolean => {
          const href = node.path ? node.path : undefined;
          const selfSelected = href ? pathname.includes(`/${href}`) : false;
          let childSelected = false;
          if (Array.isArray(node.items)) {
            for (const c of node.items) {
              if (visit(c)) {
                childSelected = true;
              }
            }
          }
          if ((includeDefaults && !!node.expanded) || childSelected || selfSelected) {
            ids.add(node.id);
          }
          return selfSelected || childSelected;
        };
        for (const n of nodes) visit(n);
        return ids;
      };
      // Start fully collapsed by default; only open selected ancestors
      const includeDefaults = false;
      setOpenIds(
        (prev) =>
          new Set<string>([
            ...prev,
            ...collectOpenAncestors(NAV_BY_SCOPE[scope] ?? [], location.pathname, includeDefaults),
          ]),
      );
    }, [location.pathname, scope, hadStorage]);

    // Map to EuiSideNav items using a local SideNavItem type
    const toSideNavItems = (nodes: NavNode[], pathname: string): SideNavItem[] =>
      nodes.map((n): SideNavItem => {
        const childItems = n.items ? toSideNavItems(n.items, pathname) : undefined;
        // Mark selected if current path starts with node path or any child is selected
        const href = n.path ? n.path : undefined;
        const childSelected = Array.isArray(childItems) && childItems.some((c) => c.isSelected);
        const isSelected = href ? pathname.includes(`/${href}`) || childSelected : childSelected;
        const isGroup = Array.isArray(childItems) && childItems.length > 0;
        // Default collapsed: don’t use config-expanded for default; open only if user toggled or selection dictates
        const isOpen = openIds.has(n.id) || isSelected || !!childSelected;
        return {
          id: n.id,
          name: n.name,
          items: childItems,
          isSelected,
          isOpen,
          onClick: isGroup
            ? (e) => {
                e.preventDefault();
                toggleOpen(n.id);
              }
            : href
            ? (e) => {
                e.preventDefault();
                void navigate(href);
              }
            : undefined,
        };
      });

    const sideNavItems: SideNavItem[] = toSideNavItems(NAV_BY_SCOPE[scope] ?? [], location.pathname);
    return (
      <EuiSideNav
        items={sideNavItems as unknown as EuiSideNavProps["items"]}
        mobileTitle="Navigation"
        toggleOpenOnMobile={() => {}}
      />
    );
  }
  const createTreeViews = (items = treeItems): JSX.Element[] => {
    const viewItems: JSX.Element[] = [];
    items.forEach((item, i) => {
      viewItems.push(createTreeView(item, i));
    });
    return viewItems;
  };

  return <>{createTreeViews(treeItems)}</>;
}

export { ScopedNav };
