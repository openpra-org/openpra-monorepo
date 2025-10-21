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

interface TreeItem {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  icon?: JSX.Element;
  iconType?: string;
  callback?: () => NonNullable<unknown>;
}

export interface ScopedNavProps {
  type: string;
}

function ScopedNav(props: ScopedNavProps): JSX.Element {
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

  const POS = [
    createTreeItem("Plant Operating State Analysis", {
      icon: <EuiToken iconType="sparkles" />,
      callback: () => {
        void navigate("plant-operating-state-analysis");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Operating State Analysis",
          {
            icon: <EuiToken iconType="shard" />,
            callback: () => {
              void navigate("operating-state-analysis");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const IE = [
    createTreeItem("Initiating Event Analysis", {
      isExpanded: true,
      callback: () => {
        void navigate("initiating-event-analysis");
      },
      children: [
        createTreeItem(
          "Initiating Events",
          {
            icon: <EuiToken iconType="shard" />,
            callback: () => {
              void navigate("initiating-events");
            },
          },
          1,
        ),
        createTreeItem(
          "Model View",
          {
            icon: <EuiToken iconType="shard" />,
            callback: () => {
              void navigate("initiating-events-model-view");
            },
          },
          1,
        ),
        createTreeItem(
          "Heat Balance fault Trees",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("heat-balance-fault-trees");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const ES = [
    createTreeItem("Event Sequence Analysis", {
      isExpanded: true,
      callback: () => {
        void navigate("event-sequence-analysis");
      },
      children: [
        createTreeItem(
          "Event Sequence Analysis",
          {
            icon: <EuiToken iconType="aggregate" />,
            callback: () => {
              void navigate("event-sequence-analysis");
            },
          },
          1,
        ),
        createTreeItem(
          "Event Sequence Diagrams",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("event-sequence-diagrams");
            },
          },
          1,
        ),
        createTreeItem(
          "Event Trees",
          {
            icon: (
              <EuiToken
                iconType="editorBold"
                shape="square"
              />
            ),
            callback: () => {
              void navigate("event-trees");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const SC = [
    createTreeItem("Success Criteria Developement", {
      isExpanded: true,
      callback: () => {
        void navigate("success-criteria-developement");
      },
      children: [
        createTreeItem(
          "Success Criteria",
          {
            icon: <EuiToken iconType="stats" />,
            callback: () => {
              void navigate("success-criteria");
            },
          },
          1,
        ),
        createTreeItem(
          "Functional Events",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("functional-events");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const SY = [
    createTreeItem("Systems Analysis", {
      isExpanded: true,
      callback: () => {
        void navigate("systems-analysis");
      },
      children: [
        createTreeItem(
          "Systems Analysis",
          {
            icon: (
              <EuiToken
                iconType="aggregate"
                shape="square"
              />
            ),
            callback: () => {
              void navigate("systems-analysis");
            },
          },
          1,
        ),
        createTreeItem(
          "Fault Trees",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("fault-trees");
            },
          },
          1,
        ),
        createTreeItem(
          "Bayesian Networks",
          {
            icon: (
              <EuiToken
                iconType="editorBold"
                shape="square"
              />
            ),
            callback: () => {
              void navigate("bayesian-networks");
            },
          },
          1,
        ),
        createTreeItem(
          "Markov Chains",
          {
            icon: (
              <EuiToken
                iconType="tokenShape"
                shape="square"
              />
            ),
            callback: () => {
              void navigate("markov-chains");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const HR = [
    createTreeItem("Human Reliability Analysis", {
      callback: () => {
        void navigate("human-reliability-analysis");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Human Reliability Analysis",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("human-reliability-analysis");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const DA = [
    createTreeItem("Data Analysis", {
      isExpanded: true,
      callback: () => {
        void navigate("data-analysis");
      },
      children: [
        createTreeItem(
          "Data Analysis",
          {
            icon: (
              <EuiToken
                iconType="aggregate"
                shape="square"
              />
            ),
            callback: () => {
              void navigate("data-analysis");
            },
          },
          1,
        ),
        createTreeItem(
          "Bayesian Estimation",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("bayesian-estimation");
            },
          },
          1,
        ),
        createTreeItem(
          "Weibull Analysis",
          {
            icon: (
              <EuiToken
                iconType="bolt"
                shape="square"
              />
            ),
            callback: () => {
              void navigate("weibull-analysis");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const FL = [
    createTreeItem("Internal Flood PRA", {
      callback: () => {
        void navigate("internal-flood-pra");
      },
    }),
  ];

  const F = [
    createTreeItem("Internal Fire PRA", {
      callback: () => {
        void navigate("internal-fire-pra");
      },
    }),
  ];

  const S = [
    createTreeItem("Seismic PRA", {
      callback: () => {
        void navigate("seismic-pra");
      },
    }),
  ];

  const HS = [
    createTreeItem("Hazards Screening Analysis", {
      callback: () => {
        void navigate("hazards-screening-analysis");
      },
    }),
  ];

  const W = [
    createTreeItem("High Winds PRA", {
      callback: () => {
        void navigate("high-winds-pra");
      },
    }),
  ];

  const XF = [
    createTreeItem("External Flooding PRA", {
      callback: () => {
        void navigate("external-flooding-pra");
      },
    }),
  ];

  const O = [
    createTreeItem("Other Hazards PRA", {
      callback: () => {
        void navigate("other-hazards-pra");
      },
    }),
  ];

  const ESQ = [
    createTreeItem("Event Sequence Quantification", {
      callback: () => {
        void navigate("event-sequence-quantification");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Event Sequence Quantification Diagrams",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("event-sequence-quantification-diagrams");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const MS = [
    createTreeItem("Mechanistic Source Term Analysis", {
      callback: () => {
        void navigate("mechanistic-source-term-analysis");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Mechanistic Source Terms",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("mechanistic-source-terms");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const RC = [
    createTreeItem("Radiological Consequence Analysis", {
      callback: () => {
        void navigate("radiological-consequence-analysis");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Radiological Consequence Analysis",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("radiological-consequence-analysis");
            },
          },
          1,
        ),
      ],
    }),
  ];

  const RI = [
    createTreeItem("Risk Integration", {
      callback: () => {
        void navigate("risk-integration");
      },
      isExpanded: true,
      children: [
        createTreeItem(
          "Risk Integration",
          {
            icon: <EuiToken iconType="tokenRepo" />,
            callback: () => {
              void navigate("risk-integration");
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
          void navigate("settings");
        },
      },
      0,
    ),
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

  let treeItems = [POS];

  if (type === "InternalEvents") {
    treeItems = [POS, IE, ES, SC, SY, HR, DA, ESQ, MS, RC, RI];
  }
  if (type === "InternalHazards") {
    treeItems = [POS, IE, ES, SC, SY, HR, DA, FL, F, HS, O, ESQ, MS, RC, RI];
  }
  if (type === "ExternalHazards") {
    treeItems = [POS, IE, ES, SC, SY, HR, DA, S, HS, W, XF, O, ESQ, MS, RC, RI];
  }
  if (type === "FullScope") {
    treeItems = [POS, IE, ES, SC, SY, HR, DA, FL, F, S, HS, W, XF, O, ESQ, MS, RC, RI];
  }

  treeItems.push(settings);
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
