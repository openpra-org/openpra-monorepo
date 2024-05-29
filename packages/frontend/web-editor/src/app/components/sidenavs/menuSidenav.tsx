import {
  EuiIcon,
  EuiTreeView,
  slugify,
  EuiToken,
  useEuiTheme,
  EuiText,
  EuiCollapsibleNavGroup,
  useEuiPaddingSize,
} from "@elastic/eui";
import { Node } from "@elastic/eui/src/components/tree_view/tree_view";
import { useNavigate } from "react-router-dom";
import { EuiAvatar, EuiSelectableOption } from "@elastic/eui";

interface TreeItem {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  icon?: JSX.Element;
  callback?: () => NonNullable<unknown>;
}

export interface ScopedNavProps {
  type: string;
}

function MenuSideNav(props: ScopedNavProps): JSX.Element {
  const { type } = props;

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

  //here we are listing off all the different possible options that can be in a menu

  const POS = [
    createTreeItem("Category 1", {
      icon: <EuiToken iconType="sparkles" />,
      callback: () => {
        navigate("plant-operating-state-analysis");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Internal Events",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="Internal Events"
                size="s"
              />
            ),
            callback: () => {
              navigate("operating-state-analysis");
            },
          },
          1,
        ),
        createTreeItem(
          "Internal Hazards",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="Internal Hazards"
                size="s"
              />
            ),
            callback: () => {
              navigate("internal-hazards");
            },
          },
          1,
        ),

        createTreeItem(
          "External Hazards",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="External Hazards"
                size="s"
              />
            ),
            callback: () => {
              navigate("operating-state-analysis");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const IE = [
    createTreeItem("Category 2", {
      isExpanded: true,
      callback: () => {
        navigate("initiating-event-analysis");
      },
      children: [
        createTreeItem(
          "Full Scope",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="Full Scope"
                size="s"
              />
            ),
            callback: () => {
              navigate("initiating-events");
            },
          },
          1,
        ),
        createTreeItem(
          "Data Analysis",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="Data Analysis"
                size="s"
              />
            ),
            callback: () => {
              navigate("initiating-events-model-view");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const ES = [
    createTreeItem("Category 3", {
      isExpanded: true,
      callback: () => {
        navigate("event-sequence-analysis");
      },
      children: [
        createTreeItem(
          "Physical Security",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="Physical Security"
                size="s"
              />
            ),
            callback: () => {
              navigate("event-sequence-analysis");
            },
          },
          1,
        ),
        createTreeItem(
          "Cybersecurity",
          {
            icon: (
              <EuiAvatar
                type="space"
                name="Cyber Security"
                size="s"
              />
            ),
            callback: () => {
              navigate("event-sequence-diagrams");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const settings = [
    createTreeItem(
      "Settings",
      {
        icon: <EuiIcon type="gear" />,
        callback: () => {
          navigate("settings");
        },
      },
      0,
    ),
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
          iconType={items[0].icon?.props.type}
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
        iconType={items[0].icon?.props.type}
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
  let treeItems = [POS];

  if (type === "InternalEvents") {
    treeItems = [POS, IE, ES];
  }
  if (type === "InternalHazards") {
    treeItems = [POS, IE, ES];
  }
  if (type === "ExternalHazards") {
    treeItems = [POS, IE, ES];
  }
  if (type === "FullScope") {
    treeItems = [POS, IE, ES];
  }

  treeItems.push(settings);
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

export { MenuSideNav };
