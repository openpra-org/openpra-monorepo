import {
  EuiIcon,
  EuiTreeView,
  slugify,
  EuiToken,
  useEuiTheme,
  EuiText,
  EuiCollapsibleNavGroup,
  useEuiPaddingSize,
  useEuiBackgroundColor
} from "@elastic/eui";
import { Node } from "@elastic/eui/src/components/tree_view/tree_view"
import { useNavigate } from "react-router-dom";

type TreeItem = {
  id: string;
  key: string;
  isExpanded?: boolean;
  label: JSX.Element;
  children?: TreeItem[];
  icon?: JSX.Element;
  callback?: () => {};
}

export interface scopedNavProps {
  type: string
}

export default function ScopedNav(props: scopedNavProps) {

  const {type} = props

  const { euiTheme } = useEuiTheme();

  const createTreeItem = (label: string, data = {}, depth = 0): TreeItem => {
    let size : "xs" | "s" | "m" | "relative" = "relative";
    let text;
    let color: string;
    switch (depth) {
      case 0:
        text = <h5 style={{textTransform: "uppercase"}}>{label}</h5>;
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
      label: <EuiText size={size} color={color} title={label}>{text}</EuiText>,
      ...data,
    };
  }

  const navigate = useNavigate();

  //here we are listing off all the different possible options that can be in a menu

  const POS = [
    createTreeItem("Plant Operating State Analysis",  {
      icon: <EuiToken iconType="sparkles"/>,
      callback: () => {navigate('plant-operating-state-analysis')},
    }),
  ];

  const IE = [
    createTreeItem("Initiating Event Analysis",  {
      isExpanded: true, 
      callback: () => {navigate('initiating-event-analysis')},
      children: [
        createTreeItem("Initiating Events", {
          icon: <EuiToken iconType="shard"/>,
          callback: () => {navigate('initiating-events')},
        }, 1),
      ],
    }),
  ];

  const ES = [
    createTreeItem("Event Sequence Analysis",  {
      isExpanded: true,
      callback: () => {navigate('event-sequence-analysis')},
      children: [
        createTreeItem("Event Sequence Diagrams", {
          icon: <EuiToken iconType="tokenRepo"/>,
          callback: () => {navigate('event-sequence-diagrams')},
        }, 1),
        createTreeItem("Event Trees", {
          icon: <EuiToken iconType="editorBold" shape="square"/>,
          callback: () => {navigate('event-trees')},
        }, 1),
      ],
    }),
  ];

  const SC = [
    createTreeItem("Success Criteria Developement",  {
      isExpanded: true,
      callback: () => {navigate('success-criteria-developement')},
      children: [
        createTreeItem("Functional Events", {
          icon: <EuiToken iconType="tokenRepo"/>,
          callback: () => {navigate('functional-events')},
        }, 1),
      ],
    }),
  ];
  const SY = [
    createTreeItem("Systems Analysis",  {
      isExpanded: true,
      callback: () => {navigate('systems-analysis')},
      children: [
        createTreeItem("Fault Trees", {
          icon: <EuiToken iconType="tokenRepo"/>,
          callback: () => {navigate('fault-trees')},
        }, 1),
        createTreeItem("Bayesian Networks", {
          icon: <EuiToken iconType="editorBold" shape="square"/>,
          callback: () => {navigate('bayesian-networks')},
        }, 1),
        createTreeItem("Markov Chains", {
          icon: <EuiToken iconType="tokenShape" shape="square"/>,
          callback: () => {navigate('markov-chains')},
        }, 1),
      ],
    }),
  ];

  const HR = [
    createTreeItem("Human Reliability Analysis",  {
      callback: () => {navigate('human-reliability-analysis')},
    }),
  ];

  const DA = [
    createTreeItem("Data Analysis",  {
      isExpanded: true,
      callback: () => {navigate('data-analysis')},
      children: [
        createTreeItem("Bayesian Estimation", {
          icon: <EuiToken iconType="tokenRepo"/>,
          callback: () => {navigate('bayesian-estimation')},
        }, 1),
        createTreeItem("Weibull Analysis", {
          icon: <EuiToken iconType="editorBold" shape="square"/>,
          callback: () => {navigate('weibull-analysis')},
        }, 1),
      ],
    }),
  ];

  const FL = [
    createTreeItem("Internal Flood PRA",  {
      callback: () => {navigate('internal-flood-pra')},
    }),
  ];

  const F = [
    createTreeItem("Internal Fire PRA",  {
      callback: () => {navigate('internal-fire-pra')},
    }),
  ];

  const S = [
    createTreeItem("Seismic PRA",  {
      callback: () => {navigate('seismic-pra')},
    }),
  ];

  const HS = [
    createTreeItem("Hazards Screening Analysis",  {
      callback: () => {navigate('hazards-screening-analysis')},
    }),
  ];

  const W = [
    createTreeItem("High Winds PRA",  {
      callback: () => {navigate('high-winds-pra')},
    }),
  ];

  const XF = [
    createTreeItem("External Flooding PRA",  {
      callback: () => {navigate('external-flooding-pra')},
    }),
  ];

  const O = [
    createTreeItem("Other Hazards PRA",  {
      callback: () => {navigate('other-hazards-pra')},
    }),
  ];

  const ESQ = [
    createTreeItem("Event Sequence Quantification",  {
      callback: () => {navigate('event-sequence-quantification')},
    }),
  ];

  const MS = [
    createTreeItem("Mechanistic Source Term Analysis",  {
      callback: () => {navigate('mechanistic-source-term-analysis')},
    }),
  ];

  const RC = [
    createTreeItem("Radiological Consequence Analysis",  {
      callback: () => {navigate('radiological-consequence-analysis')},
    }),
  ];

  const RI = [
    createTreeItem("Risk Integration",  {
      callback: () => {navigate('risk-integration')},
    }),
  ];

  // const quantificationHistory = [
  //   createTreeItem("Quantification History",  {
  //     icon: <EuiIcon type="visAreaStacked" />,
  //     callback: () => {navigate('quantification-history')},
  //   }, 0),
  // ];

  // const globalParams = [
  //   createTreeItem("Global Parameters",  {
  //     icon: <EuiIcon type="beta" />,
  //     callback: () => {navigate('global-parameters')},
  //   }, 0),
  // ];

  const settings = [
    createTreeItem("Settings",  {
      icon: <EuiIcon type="gear" />,
      callback: () => {navigate('settings')},
    }, 0),
  ];


  const backgroundColor =  useEuiBackgroundColor("plain");
  const padding = useEuiPaddingSize("s") || '0px';

  const createTreeView = (items: TreeItem[], i: number, forceTreeView = false) => {
//TODO
    if (forceTreeView) {
      const style = {
        //commented this out because I think it adds a bit of unneeded color, I will see what some other people think
        //background: backgroundColor,
        borderWidth: euiTheme.border.width["thin"],
        borderRadius: euiTheme.border.radius["medium"],
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
        {createTreeView(items[0].children, i+100, true)}
      </EuiCollapsibleNavGroup>
    );
  }

  //here is where we set the different options to be available depending on the type of page being accessed
  let treeItems = [POS]

  if(type === "InternalEvents"){
    treeItems = [
      POS,
      IE,
      ES,
      SC,
      SY,
      HR,
      DA,
      ESQ,
      MS,
      RC,
      RI,
    ];
  }
  if(type === "InternalHazards"){
    treeItems = [
      POS,
      IE,
      ES,
      SC,
      SY,
      HR,
      DA,
      FL,
      F,
      HS,
      O,
      ESQ,
      MS,
      RC,
      RI

    ];
  }
  if(type === "ExternalHazards"){
    treeItems = [
      POS,
      IE,
      ES,
      SC,
      SY,
      HR,
      DA,
      S,
      HS,
      W,
      XF,
      O,
      ESQ,
      MS,
      RC,
      RI
    ];
  }
  if(type === "FullScope"){
    treeItems = [
      POS,
      IE,
      ES,
      SC,
      SY,
      HR,
      DA,
      FL,
      F,
      S,
      HS,
      W,
      XF,
      O,
      ESQ,
      MS,
      RC,
      RI
    ];
  }

  treeItems.push(settings);
  const createTreeViews = (items = treeItems) => {
    const viewItems: JSX.Element[] = [];
    items.forEach((item, i) => {
      viewItems.push(...[
        createTreeView(item, i),
        // <EuiHorizontalRule margin="xs" key={items.length + i} />,
      ]);
    });
    return (viewItems);
  }

  return(<>{createTreeViews(treeItems)}</>);
}