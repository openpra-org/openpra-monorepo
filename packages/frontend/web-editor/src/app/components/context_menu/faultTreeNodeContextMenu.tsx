import React from "react";
import { EuiKeyPadMenu, EuiKeyPadMenuItem } from "@elastic/eui";
import { UseFaultTreeContextMenuClick } from "../../hooks/faultTree/useFaultTreeContextMenuClick";
import { NodeIcon } from "../treeNodes/icons/nodeIcon";
import { NodeTypes } from "../treeNodes/icons/interfaces/nodeProps";
import styles from "./styles/faultTreeNodeContextMenu.module.css";

export type treeNodeContextMenuProps = {
  id: string;
  top: number | false | undefined;
  left: number | false | undefined;
  right: number | false | undefined;
  bottom: number | false | undefined;
  onClick?: () => void;
};

function FaultTreeNodeContextMenu({
  id,
  top,
  left,
  right,
  bottom,
  ...props
}: treeNodeContextMenuProps): JSX.Element {
  const { handleContextMenuClick } = UseFaultTreeContextMenuClick(id);
  return (
    <EuiKeyPadMenu
      className={styles.context_menu_container}
      data-testid="app-menu-content"
      style={{ width: 310 }}
      {...props}
    >
      <div id={"orGate"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.OrGate}
            iconProps={{
              width: "30px",
              height: "100%",
              viewBox: "109.34 8.5 234.19 193.67",
            }}
          />
        </EuiKeyPadMenuItem>
      </div>
      <div id={"andGate"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.AndGate}
            iconProps={{
              width: "30px",
              height: "100%",
              viewBox: "135.61 4.76 137.82 120.94",
            }}
          />
        </EuiKeyPadMenuItem>
      </div>
      <div id={"atLeastGate"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.AtLeastGate}
            iconProps={{
              width: "30px",
              height: "100%",
              viewBox: "96 96 308 308",
            }}
          />
        </EuiKeyPadMenuItem>
      </div>
      <div id={"notGate"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.NotGate}
            iconProps={{
              width: "30px",
              height: "100%",
              viewBox: "146.071 12.679 158.5 154.641",
            }}
          />
        </EuiKeyPadMenuItem>
      </div>
      <div id={"basicEvent"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.BasicEvent}
            iconProps={{
              width: "30px",
              height: "100%",
              viewBox: "0 3 122.61 125.61",
            }}
          />
        </EuiKeyPadMenuItem>
      </div>
      <div id={"houseEvent"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.HouseEvent}
            iconProps={{ width: "30px", height: "100%", viewBox: "0 0 42 42" }}
          />
        </EuiKeyPadMenuItem>
      </div>
      <div id={"transferGate"} onClick={handleContextMenuClick}>
        <EuiKeyPadMenuItem label="">
          <NodeIcon
            nodeType={NodeTypes.TransferGate}
            iconProps={{
              width: "30px",
              height: "100%",
              viewBox: "14.4 15.4 71.2 70.2",
            }}
          />
        </EuiKeyPadMenuItem>
      </div>
    </EuiKeyPadMenu>
  );
}

export { FaultTreeNodeContextMenu };
