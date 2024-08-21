import { EuiTreeView, slugify, useEuiTheme, EuiText, EuiCollapsibleNavGroup, useEuiPaddingSize } from "@elastic/eui";
import { Node } from "@elastic/eui/src/components/tree_view/tree_view";
import { useNavigate } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { useContext } from "react";
import { AbilityContext } from "../../providers/ability/AbilityProvider";

interface TreeItem {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  iconType?: string;
  callback?: () => void;
}

/**
 * Function to export the navigation menu for the settings screen
 * @returns - JSX.Element containing the entire side navigation
 */
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

  //here we are listing off all the different possible options that can be in a menu

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
              navigate("users");
            },
          },
          1,
        ),
        createTreeItem(
          "Preferences",
          {
            iconType: "preferences",
            callback: () => {
              navigate("preferences/" + userId + "/personal-data");
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
              navigate("roles");
            },
          },
          1,
        ),
        createTreeItem(
          "Invitations",
          {
            iconType: "email",
            callback: () => {
              navigate("invitations");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const padding = useEuiPaddingSize("s") ?? "0px";

  const createTreeView = (items: TreeItem[], i: number, forceTreeView = false): JSX.Element => {
    //TODO
    if (forceTreeView) {
      const style = {
        //commented this out because I think it adds a bit of unneeded color, I will see what some other people think
        //background: backgroundColor,
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
            // display="compressed"
          />
        </div>
      );
    }

    //single node
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

  //here is where we set the different options to be available depending on the type of page being accessed
  let treeItems = [SETTINGS];
  if (ability.can("create", "users")) {
    treeItems = [...treeItems, ACCESS];
  }

  const createTreeViews = (items = treeItems): JSX.Element[] => {
    const viewItems: JSX.Element[] = [];
    items.forEach((item, i) => {
      viewItems.push(
        ...[
          createTreeView(item, i),
          // <EuiHorizontalRule margin="xs" key={items.length + i} />,
        ],
      );
    });
    return viewItems;
  };

  return <>{createTreeViews(treeItems)}</>;
}
