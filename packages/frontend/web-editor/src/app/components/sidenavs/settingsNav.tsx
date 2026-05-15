import { EuiTreeView, slugify, useEuiTheme, EuiText, EuiCollapsibleNavGroup, useEuiPaddingSize } from "@elastic/eui";
import { Node } from "@elastic/eui/src/components/tree_view/tree_view";
import { useNavigate } from "react-router-dom";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { useContext } from "react";
import { AbilityContext } from "../../providers/abilityProvider";
interface TreeItem {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  iconType?: string;
  callback?: () => void;
}
export function SettingsNav(): JSX.Element {
  const { euiTheme } = useEuiTheme();
  const ability = useContext(AbilityContext);
  const userId = ApiManager.getCurrentUser().user_id;
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
        size = "m";
        text = <h6>{label}</h6>;
        color = euiTheme.colors.darkestShade;
        break;
      default:
        size = "s";
        text = label;
        color = "primary";
        break;
    }
    const slug = slugify(label);
    return {
      id: slug,
      key: slug,
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
  const SETTINGS = [
    createTreeItem("Settings", {
      iconType: "advancedSettingsApp",
      callback: undefined,
      isExpanded: true,
      children: [
        createTreeItem(
          "All Users",
          {
            iconType: "users",
            callback: () => {
              void navigate("users");
            },
          },
          1,
        ),
        createTreeItem(
          "Preferences",
          {
            iconType: "preferences",
            callback: () => {
              void navigate("preferences/" + String(userId) + "/personal-data");
            },
          },
          1,
        ),
      ],
    }),
  ];
  const ACCESS = [
    createTreeItem("Access", {
      iconType: "advancedSettingsApp",
      callback: undefined,
      isExpanded: true,
      children: [
        createTreeItem(
          "Roles",
          {
            iconType: "usersRolesApp",
            callback: () => {
              void navigate("roles");
            },
          },
          1,
        ),
        createTreeItem(
          "Invitations",
          {
            iconType: "email",
            callback: () => {
              void navigate("invitations");
            },
          },
          1,
        ),
      ],
    }),
  ];
  const padding = useEuiPaddingSize("s");
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
            items={items as unknown as Node[]}
            key={i}
            aria-label="Model Sidebar"
            expandByDefault={false}
            showExpansionArrows
          />
        </div>
      );
    }
    if (!items[0].children) {
      return (
        <EuiCollapsibleNavGroup
          title={items[0].label}
          iconType={items[0].iconType}
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
        iconType={items[0].iconType}
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
  let treeItems = [SETTINGS];
  if (ability.can("create", "users")) {
    treeItems = [...treeItems, ACCESS];
  }
  const createTreeViews = (items = treeItems): JSX.Element[] => {
    const viewItems: JSX.Element[] = [];
    items.forEach((item, i) => {
      viewItems.push(...[createTreeView(item, i)]);
    });
    return viewItems;
  };
  return <>{createTreeViews(treeItems)}</>;
}
