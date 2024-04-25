import React, { memo, MemoExoticComponent, useCallback, useState } from "react";
import { Handle, Node, NodeProps, Position, useReactFlow } from "reactflow";
import { NodeIcon } from "../icons/nodeIcon";
import { NodeTypes } from "../icons/interfaces/nodeProps";
import { UseNodeDoubleClick } from "../../../hooks/heatBalanceFaultTree/useNodeDoubleClick";
import { UseGrayedNodeHover } from "../../../hooks/heatBalanceFaultTree/useGrayedNodeHover";
import { UseGrayedNodeClick } from "../../../hooks/heatBalanceFaultTree/useGrayedNodeClick";
import { EuiFieldText } from "@elastic/eui";
import { debounce } from "lodash";
import {
  AND_GATE,
  AND_GATE_LABEL,
  BASIC_EVENT,
  BASIC_EVENT_LABEL,
  NOT_GATE,
  NOT_GATE_LABEL,
  OR_GATE,
  OR_GATE_LABEL,
  SOURCE,
  TARGET,
  TRANSFER_GATE,
  TRANSFER_GATE_LABEL,
} from "../../../../utils/constants";
import { HeatBalanceFaultTreeNodeProps } from "./heatBalanceFaultTreeNodeType";
import cx from "classnames";
import styles from "./styles/nodeTypes.module.css";
import { UpdateHeatBalanceFaultTreeLabel } from "../../../../utils/treeUtils";

const stylesMap = styles as Record<string, string>;

/**
 * Get Node Elements for the node - editable label and handles
 * @param id - Node ID
 * @param type - Node Type
 * @param data - Node properties
 * @returns Editable Label and Handles for the node
 */
function GetEditableNode(
  id: NodeProps["id"],
  type: string,
  data: HeatBalanceFaultTreeNodeProps,
): JSX.Element {
  let handles: JSX.Element;
  const { getNodes, setNodes } = useReactFlow();
  const [nodeLabel, setNodeLabel] = useState(data.label ?? type);
  const updateHandler = useCallback(
    debounce((newLabel: string): void => {
      setNodes(
        getNodes().map((n: Node<HeatBalanceFaultTreeNodeProps>) => {
          if (n.id === id) {
            n.data.label = newLabel;
          }
          return n;
        }),
      );
      UpdateHeatBalanceFaultTreeLabel(id, newLabel, "node");
    }, 500),
    [getNodes, id, setNodes],
  );
  const onNodeLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const newLabel = e.target.value;
      setNodeLabel(newLabel);
      updateHandler(newLabel);
    },
    [updateHandler],
  );

  switch (type) {
    case "basicEvent":
      handles = (
        <>
          <Handle
            className={stylesMap.handle}
            type="target"
            position={Position.Top}
            isConnectable={false}
          />
          <Handle
            className={stylesMap.handle}
            type="source"
            position={Position.Top}
            isConnectable={false}
          />
        </>
      );
      break;
    case "initiator":
      handles = (
        <Handle
          className={stylesMap.handle}
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
      );
      break;
    default:
      throw new Error("Node Type invalid");
  }
  return (
    <>
      <EuiFieldText
        className={cx(stylesMap.node_label)}
        placeholder="Node Label"
        value={nodeLabel}
        onChange={onNodeLabelChange}
        compressed={true}
        // disabled={data.isDeleted === true || data.tentative === true}
      />
      {handles}
    </>
  );
}


function getNodeIcon(
  type: string,
  id: string,
  selected: boolean,
  data: HeatBalanceFaultTreeNodeProps,
): JSX.Element {
  switch (type) {
    case AND_GATE:
      return (
        <NodeIcon
          nodeType={NodeTypes.AndGate}
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "135.61 4.76 137.82 120.94",
          }}
        />
      );
    case OR_GATE:
      return (
        <NodeIcon
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          nodeType={NodeTypes.OrGate}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "109.34 8.5 234.19 193.67",
          }}
        />
      );
    case TRANSFER_GATE:
      return (
        <NodeIcon
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          nodeType={NodeTypes.TransferGate}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "14.4 15.4 71.2 70.2",
          }}
        />
      );
    case BASIC_EVENT:
      return (
        <NodeIcon
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          nodeType={NodeTypes.BasicEvent}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "0 3 122.61 125.61",
          }}
        />
      );
    case NOT_GATE:
      return (
        <NodeIcon
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          nodeType={NodeTypes.NotGate}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "146.071 12.679 158.5 154.641",
          }}
        />
      );
    default:
      throw new Error("Node Type Invalid");
  }
}

function getNodeLabel(type: string): string {
  switch (type) {
    case AND_GATE:
      return AND_GATE_LABEL;
    case OR_GATE:
      return OR_GATE_LABEL;
    // case BASIC_EVENT:
    //   return BASIC_EVENT_LABEL;
    case TRANSFER_GATE:
      return TRANSFER_GATE_LABEL;
    case NOT_GATE:
      return NOT_GATE_LABEL;
    default:
      return "";
  }
}

function HeatBalanceFaultTreeNode(
  type: string,
): MemoExoticComponent<React.ComponentType<NodeProps<HeatBalanceFaultTreeNodeProps>>> {
  return memo(
    ({ id, selected, data }: NodeProps & HeatBalanceFaultTreeNodeProps) => {
    const { handleNodeDoubleClick } = UseNodeDoubleClick(id);
    const { handleMouseEnter, handleMouseLeave } = UseGrayedNodeHover(id);
    const { handleGrayedNodeClick } = UseGrayedNodeClick(id);

    const mouseEnterHandler = () => {
      handleMouseEnter(data?.branchId);
    };
    const mouseLeaveHandler = () => {
      handleMouseLeave(data?.branchId);
    };
    const grayedNodeClickHandler = async () => {
      await handleGrayedNodeClick(data?.branchId);
    };

    return (
      <div
        className={styles.node_container}
        onDoubleClick={handleNodeDoubleClick}
        onClick={
          data?.branchId !== undefined ? grayedNodeClickHandler : undefined
        }
        onMouseEnter={mouseEnterHandler}
        onMouseLeave={mouseLeaveHandler}
      >
        <div
          className={
            data?.isGrayed
              ? styles.placeholder
              : `${styles.node} ${selected ? styles.selected : ``}`
          }
        >
            {type === BASIC_EVENT
              ? GetEditableNode(id, type, data)
              : getNodeLabel(type)}

          <Handle
            className={styles.handle}
            type={TARGET}
            position={Position.Top}
            isConnectable={false}
          />
          <Handle
            className={styles.handle}
            type={SOURCE}
            position={Position.Bottom}
            isConnectable={false}
          />
        </div>
        {getNodeIcon(type, id, selected, data)}
      </div>
    );
  });
}

export { HeatBalanceFaultTreeNode };
