import React from "react";
import { EuiContextMenuPanelDescriptor, EuiContextMenu, EuiIcon } from "@elastic/eui";
import { EDITOR_BLUE_COLOR, MEDIUM, TRASH } from "../../../utils/constants";
export interface BayesianNodeContextMenuProps {
  nodeId: string;
  onActionSelect: (action: string, nodeId: string) => void;
  onClose: () => void;
  position: {
    x: number;
    y: number;
  };
  getParents: (nodeId: string) => string[];
  getChildren: (nodeId: string) => string[];
  getParentLabels: (nodeId: string) => string[];
  getChildrenLabels: (nodeId: string) => string[];
}
const BayesianNodeContextMenu: React.FC<BayesianNodeContextMenuProps> = ({
  nodeId,
  onActionSelect,
  position,
  getParents,
  getChildren,
  getParentLabels,
  getChildrenLabels,
}) => {
  const menuStyle: React.CSSProperties = {
    position: "absolute",
    left: `${String(position.x)}px`,
    top: `${String(position.y)}px`,
    background: "white",
    zIndex: 1000,
  };
  const parents = getParents(nodeId);
  const children = getChildren(nodeId);
  const parentLabels = getParentLabels(nodeId);
  const childrenLabels = getChildrenLabels(nodeId);
  const parentItems = parentLabels.map((label, index) => {
    const parentId = parents[index];
    return {
      name: `Parent: ${label}`,
      onClick: (): void => {
        onActionSelect("highlightNode", parentId);
      },
    };
  });
  const childrenItems = childrenLabels.map((label, index) => {
    const childId = children[index];
    return {
      name: `Child: ${label}`,
      onClick: (): void => {
        onActionSelect("highlightNode", childId);
      },
    };
  });
  const panels: EuiContextMenuPanelDescriptor[] = [
    {
      id: 0,
      items: [
        {
          name: "Add Parent",
          icon: (
            <EuiIcon
              type={"plusInCircle"}
              size={MEDIUM}
              color={EDITOR_BLUE_COLOR}
            >
              {" "}
            </EuiIcon>
          ),
          onClick: (): void => {
            onActionSelect("addParent", nodeId);
          },
        },
        {
          name: "Delete Node",
          icon: (
            <EuiIcon
              type={TRASH}
              size={MEDIUM}
              color={EDITOR_BLUE_COLOR}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onActionSelect("deleteNode", nodeId);
          },
        },
        ...(parents.length > 0 ?
          [
            {
              name: "Show Parents",
              icon: (
                <EuiIcon
                  type={"user"}
                  size={MEDIUM}
                  color={EDITOR_BLUE_COLOR}
                ></EuiIcon>
              ),
              panel: 1,
            },
          ]
        : []),
        ...(children.length > 0 ?
          [
            {
              name: "Show Children",
              icon: (
                <EuiIcon
                  type={"users"}
                  size={MEDIUM}
                  color={EDITOR_BLUE_COLOR}
                ></EuiIcon>
              ),
              panel: 2,
            },
          ]
        : []),
      ],
    },
    ...(parents.length > 0 ?
      [
        {
          id: 1,
          title: "Parent",
          items: parentItems,
        },
      ]
    : []),
    ...(children.length > 0 ?
      [
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
      <EuiContextMenu
        initialPanelId={0}
        panels={panels}
      />
    </div>
  );
};
export { BayesianNodeContextMenu };
