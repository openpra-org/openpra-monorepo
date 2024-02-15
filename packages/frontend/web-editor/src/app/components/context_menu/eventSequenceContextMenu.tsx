import React from "react";
import {
  EuiHorizontalRule,
  EuiKeyPadMenu,
  EuiKeyPadMenuItem,
} from "@elastic/eui";
import { UseEventSequenceContextMenuClick } from "../../hooks/eventSequence/useContextMenuClick";
import { NodeTypes } from "../treeNodes/eventSequenceNodes/icons/interfaces/nodeProps";
import { NodeIcon } from "../treeNodes/eventSequenceNodes/icons/nodeIcon";
import { EventSequenceContextMenuOptions } from "./interfaces/eventSequenceContextMenuOptions.interface";
import styles from "./styles/eventSequenceContextMenu.module.css";

/**
 * @public The context menu with different types of nodes of Event Sequence Diagram
 * @param EventSequenceContextMenuOptions - options to load the menu
 * @returns JSX Element
 */
function EventSequenceContextMenu({
  id,
  top,
  left,
  ...props
}: EventSequenceContextMenuOptions): JSX.Element {
  const { useHandleContextMenuClick } = UseEventSequenceContextMenuClick(id);
  return (
    <EuiKeyPadMenu
      data-testid="app-menu-content"
      style={{ width: 310, height: 196 }}
      {...props}
    >
      <EuiKeyPadMenuItem label="Functional">
        <div
          className={styles.context_menu_option}
          onClick={useHandleContextMenuClick}
          id={"functional"}
        >
          <NodeIcon
            nodeType={NodeTypes.Functional}
            iconProps={{
              showText: false,
              width: "70",
              height: "60",
              selected: false,
            }}
          />
        </div>
      </EuiKeyPadMenuItem>
      <EuiKeyPadMenuItem label="Description">
        <div
          className={styles.context_menu_option}
          onClick={useHandleContextMenuClick}
          id={"description"}
        >
          <NodeIcon
            nodeType={NodeTypes.Description}
            iconProps={{
              showText: false,
              width: "80",
              height: "50",
              data: {
                cx: "48%",
                cy: "50%",
                rx: "38",
                ry: "24",
              },
              selected: false,
            }}
          />
        </div>
      </EuiKeyPadMenuItem>
      <EuiKeyPadMenuItem label="Intermediate">
        <div
          className={styles.context_menu_option}
          onClick={useHandleContextMenuClick}
          id={"intermediate"}
        >
          <NodeIcon
            nodeType={NodeTypes.Intermediate}
            iconProps={{
              showText: false,
              width: "60",
              height: "60",
              selected: false,
            }}
          />
        </div>
      </EuiKeyPadMenuItem>
      <EuiHorizontalRule />
      <EuiKeyPadMenuItem label="Not Developed">
        <div
          className={styles.context_menu_option}
          onClick={useHandleContextMenuClick}
          id={"undeveloped"}
        >
          <NodeIcon
            nodeType={NodeTypes.Undeveloped}
            iconProps={{
              showText: false,
              width: "60",
              height: "60",
              selected: false,
            }}
          />
        </div>
      </EuiKeyPadMenuItem>
      <EuiKeyPadMenuItem label="Transfer State">
        <div
          className={styles.context_menu_option}
          onClick={useHandleContextMenuClick}
          id={"transfer"}
        >
          <NodeIcon
            nodeType={NodeTypes.Transfer}
            iconProps={{
              showText: false,
              width: "60",
              height: "60",
              selected: false,
            }}
          />
        </div>
      </EuiKeyPadMenuItem>
      <EuiKeyPadMenuItem label="End State">
        <div
          className={styles.context_menu_option}
          onClick={useHandleContextMenuClick}
          id={"end"}
        >
          <NodeIcon
            nodeType={NodeTypes.End}
            iconProps={{
              showText: false,
              width: "60",
              height: "60",
              selected: false,
            }}
          />
        </div>
      </EuiKeyPadMenuItem>
      <EuiHorizontalRule />
    </EuiKeyPadMenu>
  );
}
export { EventSequenceContextMenu };
