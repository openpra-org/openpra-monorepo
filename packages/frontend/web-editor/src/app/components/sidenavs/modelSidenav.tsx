import {
  EuiIcon,
  EuiTreeView,
  slugify,
  EuiToken,
  useEuiTheme,
  EuiText,
  EuiHorizontalRule
} from "@elastic/eui";
import React from 'react'
import { Link, useNavigate } from "react-router-dom";

export default function ModelSidenav() {

  const { euiTheme } = useEuiTheme();

  const createTreeItem = (label: string, data = {}, depth = 0) => {
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

  const operatingStates = [
    createTreeItem("Operating States",  {}),
  ];

  const navigate = useNavigate();

  const initiatingEvents = [
    createTreeItem("Initiating Event Analysis",  {
      isExpanded: true,
      children: [
        createTreeItem("Initiating Events",  {
          isExpanded: true,
          callback: () => {navigate('initiating-events')},
          children: [
            createTreeItem("Initiating Event 1", {
              icon: <EuiToken iconType="tokenInterface" />,
              callback: () => {navigate('initiating-events/1')},
            }, 2,)
          ],
        }, 1),
      ],
    }),
  ];

  const eventSequenceAnalysis = [
    createTreeItem("Event Sequence Analysis",  {
      isExpanded: true,
      callback: () => {navigate('event-sequence-diagrams')},
      children: [
        createTreeItem("Event Sequence Diagrams", {
          isExpanded: true,
          children: [
            createTreeItem("Event Sequence 1", {
              icon: <EuiToken iconType="tokenEnumMember" />,
              callback: () => {navigate('event-sequence-diagrams/1')},
            }, 2),
            createTreeItem("Event Sequence 2", {
              icon: <EuiToken iconType="tokenEnumMember" />,
              callback: () => {navigate('event-sequence-diagrams/2')},
            }, 2),
          ],
        }, 1),
        createTreeItem("Event Trees", {
          isExpanded: true,
          callback: () => {navigate('event-trees')},
          children: [
            createTreeItem("Event Tree 1", {
              icon: <EuiToken iconType="tokenEnum" />,
              callback: () => {navigate('event-trees/1')},
            }, 2),
          ],
        }, 1),
      ],
    }),
  ];

  const systemsAnalysis = [
    createTreeItem("Systems Analysis",  {
      isExpanded: true,
      children: [
        createTreeItem("Fault Trees", {
          isExpanded: true,
          callback: () => {navigate('fault-trees')},
          children: [
            createTreeItem("Fault Tree 1", {
              icon: <EuiToken iconType="tokenField" />,
              callback: () => {navigate('fault-trees/1')},
            }, 2),
            createTreeItem("Fault Tree 2", {
              icon: <EuiToken iconType="tokenField" />,
              callback: () => {navigate('fault-trees/2')},
            }, 2),
            createTreeItem("Fault Tree 3", {
              icon: <EuiToken iconType="tokenField" />,
              callback: () => {navigate('fault-trees/3')},
            }, 2),
          ],
        }, 1),
        createTreeItem("Bayesian Networks", {
          isExpanded: true,
          callback: () => {navigate('bayesian-networks')},
          children: [
            createTreeItem("Bayesian Network 1", {
              icon: <EuiToken iconType="tokenPercolator" />,
              callback: () => {navigate('bayesian-networks/1')},
            }, 2),
            createTreeItem("Bayesian Network 2", {
              icon: <EuiToken iconType="tokenPercolator" />,
              callback: () => {navigate('bayesian-networks/2')},
            }, 2),
          ],
        }, 1),
      ],
    }),
  ];

  const HRA = [
    createTreeItem("Human Reliability Analysis",  {
      callback: () => {navigate('human-reliability-analysis')},
    }),
  ];

  const dataAnalysis = [
    createTreeItem("Data Analysis",  {
      isExpanded: true,
      callback: () => {navigate('data-analysis')},
      children: [
        createTreeItem("Gates", {
          icon: <EuiToken iconType="tokenRepo"/>,
          callback: () => {navigate('data-analysis/gates')},
        }, 1),
        createTreeItem("Basic Events", {
          icon: <EuiToken iconType="editorBold" shape="square"/>,
          callback: () => {navigate('data-analysis/basic-events')},
        }, 1),
        createTreeItem("CCF Groups", {
          icon: <EuiToken iconType="tokenShape" shape="square"/>,
          callback: () => {navigate('data-analysis/ccf-groups')},
        }, 1),
      ],
    }),
  ];

  const eventSequenceQuantification = [
    createTreeItem("Event Sequence Quantification",  {}),
  ];

  const consequence = [
    createTreeItem("Consequence Analysis",  {}),
  ];

  const riskIntegration = [
    createTreeItem("Risk Integration",  {}),
  ];

  const quantificationHistory = [
    createTreeItem("Quantification History",  {
      icon: <EuiIcon type="visAreaStacked" />,
      callback: () => {navigate('quantification-history')},
    }, 0),
  ];

  const globalParams = [
    createTreeItem("Global Parameters",  {
      icon: <EuiIcon type="beta" />,
      callback: () => {navigate('global-parameters')},
    }, 0),
  ];

  const settings = [
    createTreeItem("Settings",  {
      icon: <EuiIcon type="gear" />,
      callback: () => {navigate('settings')},
    }, 0),
  ];

  const createTreeView = (items: any[], i: number) => {
    return (
      <EuiTreeView
        items={items}
        key={i}
        aria-label="Model Sidebar"
        expandByDefault={false}
        showExpansionArrows
        display="compressed"
      />
    );
  }

  const treeItems = [
    operatingStates,
    initiatingEvents,
    eventSequenceAnalysis,
    systemsAnalysis,
    HRA,
    dataAnalysis,
    eventSequenceQuantification,
    consequence,
    riskIntegration,
    quantificationHistory,
    globalParams,
    settings,
  ];

  const createTreeViews = (items = treeItems) => {
    const viewItems: JSX.Element[] = [];
    items.forEach((item, i) => {
      viewItems.push(...[
        createTreeView(item, i),
        <EuiHorizontalRule margin="xs" key={items.length + i} />,
      ]);
    });
    return (viewItems);
  }

  return(<>{createTreeViews(treeItems)}</>);
}
