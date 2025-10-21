import {
  EuiTreeView,
  slugify,
  useEuiTheme,
  EuiText,
  EuiCollapsibleNavGroup,
  useEuiPaddingSize,
  useEuiBackgroundColor,
  EuiIcon,
  EuiAvatar,
} from "@elastic/eui";
import { Node } from "@elastic/eui/src/components/tree_view/tree_view";
import { useNavigate } from "react-router-dom";

interface TreeItem {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  icon?: JSX.Element;
  // Optional explicit iconType to avoid unsafe access on JSX.Element internals
  iconType?: string;
  callback?: () => NonNullable<unknown>;
}
function DataSidenav(): JSX.Element {
  const { euiTheme } = useEuiTheme();

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

  const parameterEstimates = [
    createTreeItem("Parameter Estimates", {
      isExpanded: true,
      callback: () => {
        void navigate("data-analysis");
      },
      icon: <EuiIcon type="tableDensityNormal" />,
      children: [
        createTreeItem(
          "Special Events",
          {
            icon: (
              <EuiAvatar
                size="s"
                color="subdued"
                type="space"
                name="Special Events"
              />
            ),
            callback: () => {
              void navigate("special-events");
            },
          },
          1,
        ),
        createTreeItem(
          "Component Reliability",
          {
            icon: (
              <EuiAvatar
                size="s"
                color="subdued"
                type="space"
                name="Component Reliability"
              />
            ),
            callback: () => {
              void navigate("component-reliability");
            },
          },
          1,
        ),
        createTreeItem(
          "Initiating Events",
          {
            icon: (
              <EuiAvatar
                size="s"
                color="subdued"
                type="space"
                name="Initiating Events"
              />
            ),
            callback: () => {
              void navigate("initiating-events");
            },
          },
          1,
        ),
        createTreeItem(
          "Train UA",
          {
            icon: (
              <EuiAvatar
                size="s"
                color="subdued"
                type="space"
                name="U A"
              />
            ),
            callback: () => {
              void navigate("train-ua");
            },
          },
          1,
        ),
        createTreeItem(
          "CCF",
          {
            icon: (
              <EuiAvatar
                size="s"
                color="subdued"
                type="space"
                name="CCF"
              />
            ),
            callback: () => {
              void navigate("ccf");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const backgroundColor = useEuiBackgroundColor("plain");
  const padding = useEuiPaddingSize("s");

  const createTreeView = (items: TreeItem[], i: number, forceTreeView = false): JSX.Element => {
    const getIconType = (icon?: JSX.Element): string | undefined => {
      if (!icon) return undefined;
      const props = (icon as React.ReactElement).props as { type?: unknown; iconType?: unknown };
      const t = props.type;
      if (typeof t === "string") return t;
      const it = props.iconType;
      if (typeof it === "string") return it;
      return undefined;
    };
    //TODO
    if (forceTreeView) {
      const style = {
        background: backgroundColor,
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
          iconType={items[0].iconType ?? getIconType(items[0].icon)}
          iconSize="m"
          titleSize="xs"
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
        isCollapsible={true}
        buttonElement="button"
        initialIsOpen={items[0].isExpanded}
      >
        {createTreeView(items[0].children, i + 100, true)}
      </EuiCollapsibleNavGroup>
    );
  };

  const treeItems = [parameterEstimates];

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

export { DataSidenav };
