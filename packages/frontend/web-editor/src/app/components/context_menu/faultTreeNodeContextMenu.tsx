import React from "react";
import { EuiContextMenu, EuiIcon } from "@elastic/eui";
import { UseFaultTreeContextMenuClick } from "../../hooks/faultTree/useFaultTreeContextMenuClick";
import {
  AND_GATE,
  AND_GATE_LABEL,
  ATLEAST_GATE,
  ATLEAST_GATE_LABEL,
  BASIC_EVENT,
  BASIC_EVENT_LABEL,
  DELETE_NODE,
  DELETE_SUBTREE,
  DELETE_TYPE,
  EDITOR_BLUE_COLOR,
  HOUSE_EVENT,
  HOUSE_EVENT_LABEL,
  IMPORT_ACTION,
  LARGE,
  MEDIUM,
  NODE_TYPES,
  NOT_GATE,
  NOT_GATE_LABEL,
  OR_GATE,
  OR_GATE_LABEL,
  TRANSFER_GATE,
  TRANSFER_GATE_LABEL,
  TRASH,
  UPDATE_NODE_TYPE,
  WRENCH,
} from "../../../utils/constants";
import AndGateIcon from "../../../assets/images/faultTreeNodeIcons/AndGateIcon.svg";
import AtLeastIcon from "../../../assets/images/faultTreeNodeIcons/AtLeastGateIcon.svg";
import OrGateIcon from "../../../assets/images/faultTreeNodeIcons/OrGateIcon.svg";
import NotGateIcon from "../../../assets/images/faultTreeNodeIcons/NotGateIcon.svg";
import TransferGateIcon from "../../../assets/images/faultTreeNodeIcons/TransferGateIcon.svg";
import BasicEventIcon from "../../../assets/images/faultTreeNodeIcons/BasicEventIcon.svg";
import HouseEventIcon from "../../../assets/images/faultTreeNodeIcons/HouseEventIcon.svg";

export interface TreeNodeContextMenuProps {
  id: string;
  top: number | false | undefined;
  left: number | false | undefined;
  right: number | false | undefined;
  bottom: number | false | undefined;
  onClick?: () => void;
  addToastHandler?: (type: string) => void;
}

const FaultTreeNodeContextMenu = ({
  id,
  top,
  left,
  right,
  bottom,
  addToastHandler,
  ...props
}: TreeNodeContextMenuProps): JSX.Element => {
  const { handleContextMenuClick, validateFaultTreeContextMenuClick } = UseFaultTreeContextMenuClick(id);
  const basePanelItems = [
    {
      name: UPDATE_NODE_TYPE,
      icon: (
        <EuiIcon
          type={WRENCH}
          size={MEDIUM}
          color={EDITOR_BLUE_COLOR}
        ></EuiIcon>
      ),
      panel: 1,
    },
    {
      name: "Delete",
      icon: (
        <EuiIcon
          type={TRASH}
          size={MEDIUM}
          color={EDITOR_BLUE_COLOR}
        ></EuiIcon>
      ),
      panel: 2,
    },
    {
      name: "Import JSON",
      icon: (
        <EuiIcon
          type={IMPORT_ACTION}
          size={MEDIUM}
          color={EDITOR_BLUE_COLOR}
        ></EuiIcon>
      ),
    },
  ];

  const onItemClick = async (id: string, type: string): Promise<void> => {
    const toast = validateFaultTreeContextMenuClick(id, type);
    if (toast) {
      addToastHandler && addToastHandler(toast);
    } else {
      await handleContextMenuClick(type);
    }
    const { onClick } = props;
    onClick && onClick();
  };
  const panels = [
    {
      id: 0,
      items: basePanelItems,
    },
    {
      id: 1,
      title: NODE_TYPES,
      items: [
        {
          name: AND_GATE_LABEL,
          icon: (
            <EuiIcon
              type={AndGateIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, AND_GATE);
          },
        },
        {
          name: OR_GATE_LABEL,
          icon: (
            <EuiIcon
              type={OrGateIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, OR_GATE);
          },
        },
        {
          name: ATLEAST_GATE_LABEL,
          icon: (
            <EuiIcon
              type={AtLeastIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, ATLEAST_GATE);
          },
        },
        {
          name: NOT_GATE_LABEL,
          icon: (
            <EuiIcon
              type={NotGateIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, NOT_GATE);
          },
        },
        {
          name: TRANSFER_GATE_LABEL,
          icon: (
            <EuiIcon
              type={TransferGateIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, TRANSFER_GATE);
          },
        },
        {
          name: HOUSE_EVENT_LABEL,
          icon: (
            <EuiIcon
              type={HouseEventIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, HOUSE_EVENT);
          },
        },
        {
          name: BASIC_EVENT_LABEL,
          icon: (
            <EuiIcon
              type={BasicEventIcon}
              size={LARGE}
            ></EuiIcon>
          ),
          onClick: async () => {
            await onItemClick(id, BASIC_EVENT);
          },
        },
      ],
    },
    {
      id: 2,
      title: DELETE_TYPE,
      items: [
        {
          name: DELETE_NODE,
          onClick: async () => {
            await onItemClick(id, "deleteNode");
          },
        },
        {
          name: DELETE_SUBTREE,
          onClick: async () => {
            await onItemClick(id, "deleteSubtree");
          },
        },
      ],
    },
  ];
  return (
    <EuiContextMenu
      initialPanelId={0}
      panels={panels}
      size={"s"}
    />
  );
};

export { FaultTreeNodeContextMenu };
