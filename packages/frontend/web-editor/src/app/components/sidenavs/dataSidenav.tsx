import {
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
export default function DataSidenav() {

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

  const parameterEstimates = [
    createTreeItem("Parameter Estimates",  {
      isExpanded: true,
      callback: () => {navigate('data-analysis')},
      children: [
        createTreeItem("Special Events", {
          icon: <EuiToken iconType="tableDensityNormal"/>,
          callback: () => {navigate('special-events')},
        }, 1),
        createTreeItem("Component Reliability", {
          icon: <EuiToken iconType="tableDensityNormal" shape="square"/>,
          callback: () => {navigate('component-reliability')},
        }, 1),
        createTreeItem("Initiating Events", {
          icon: <EuiToken iconType="tableDensityNormal" shape="square"/>,
          callback: () => {navigate('initiating-events')},
        }, 1),
        createTreeItem("Train UA", {
          icon: <EuiToken iconType="tableDensityNormal" shape="square"/>,
          callback: () => {navigate('train-ua')},
        }, 1),
        createTreeItem("CCF", {
          icon: <EuiToken iconType="tableDensityNormal" shape="square"/>,
          callback: () => {navigate('ccf')},
        }, 1),
      ],
    }),
  ];

  const backgroundColor =  useEuiBackgroundColor("plain");
  const padding = useEuiPaddingSize("s") || '0px';

  const createTreeView = (items: TreeItem[], i: number, forceTreeView = false) => {
//TODO
    if (forceTreeView) {
      const style = {
        background: backgroundColor,
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
        isCollapsible={true}
        buttonElement="button"
        initialIsOpen={items[0].isExpanded}
      >
        {createTreeView(items[0].children, i+100, true)}
      </EuiCollapsibleNavGroup>
    );
  }

  const treeItems = [
    parameterEstimates,
  ];

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
