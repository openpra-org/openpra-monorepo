import React from "react";
import {
  EuiContextMenuPanelDescriptor,
  EuiContextMenu,
  EuiContextMenuItem,
} from "@elastic/eui";

export type BayesianNodeContextMenuProps = {
  nodeId: string;
  onActionSelect: (action: string, nodeId: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  getParent: (nodeId: string) => string | undefined; // For a single parent
  getChildren: (nodeId: string) => string[];
  getParentLabel: (nodeId: string) => string | undefined;
  getChildrenLabels: (nodeId: string) => string[];
};

const BayesianNodeContextMenu: React.FC<BayesianNodeContextMenuProps> = ({
  nodeId,
  onActionSelect,
  onClose,
  position,
  getParent,
  getChildren,
  getParentLabel,
  getChildrenLabels,
}) => {
  const menuStyle: React.CSSProperties = {
    position: "absolute",
    left: `${position.x}px`,
    top: `${position.y}px`,
    background: 'white',
    zIndex: 1000,
  };

  const parent = getParent(nodeId); // For a single parent
  const children = getChildren(nodeId);
  const parentLabel = getParentLabel(nodeId);
  const childrenLabels = getChildrenLabels(nodeId);
  const childrenItems = childrenLabels.map((label, index) => {
    const childId = children[index]; // Assuming that children IDs are in the same order as their labels
    return {
      name: `Child: ${label}`,
      onClick: () => {
        onActionSelect("highlightNode", childId);
      },
    };
  });

  // Define the panels using EuiContextMenuPanelDescriptor
  const panels: EuiContextMenuPanelDescriptor[] = [
    {
      id: 0,
      items: [
        {
          name: "Delete Node",
          onClick: () => {
            onActionSelect("deleteNode", nodeId);
          },
        },
        ...(parent
          ? [
              {
                name: "Show Parent",
                panel: 1, // Panel ID for parent
              },
            ]
          : []),
        ...(children.length > 0
          ? [
              {
                name: "Show Children",
                panel: 2, // Panel ID for children
              },
            ]
          : []),
      ],
    },
    // Parent panel only if a parent exists
    ...(parent
      ? [
          {
            id: 1,
            title: "Parent",
            items: [
              {
                name: `Parent: ${parentLabel}`,
                onClick: () => {
                  onActionSelect("highlightNode", parent);
                },
              },
            ],
          },
        ]
      : []),
    // Children panel only if there are any children
    ...(children.length > 0
      ? [
          {
            id: 2,
            title: "Children",
            items: childrenItems,
          },
        ]
      : []),
  ];

  return (
    <div style={menuStyle}>
      <EuiContextMenu initialPanelId={0} panels={panels} />
    </div>
  );
};

export default BayesianNodeContextMenu;
