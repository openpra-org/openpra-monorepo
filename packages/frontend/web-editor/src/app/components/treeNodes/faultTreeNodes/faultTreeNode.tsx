import React, { memo, MemoExoticComponent } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { NodeIcon } from "../icons/nodeIcon";
import { NodeTypes } from "../icons/interfaces/nodeProps";
import { UseNodeDoubleClick } from "../../../hooks/faultTree/useNodeDoubleClick";
import { UseGrayedNodeHover } from "../../../hooks/faultTree/useGrayedNodeHover";
import { UseGrayedNodeClick } from "../../../hooks/faultTree/useGrayedNodeClick";
import {
  AND_GATE,
  AND_GATE_LABEL,
  ATLEAST_GATE,
  ATLEAST_GATE_LABEL,
  BASIC_EVENT,
  BASIC_EVENT_LABEL,
  HOUSE_EVENT,
  HOUSE_EVENT_LABEL,
  NOT_GATE,
  NOT_GATE_LABEL,
  OR_GATE,
  OR_GATE_LABEL,
  SOURCE,
  TARGET,
  TRANSFER_GATE,
  TRANSFER_GATE_LABEL,
} from "../../../../utils/constants";
import styles from "./styles/nodeTypes.module.css";
import { FaultTreeNodeProps } from "./faultTreeNodeType";

function getNodeIcon(
  type: string,
  id: string,
  selected: boolean,
  data: FaultTreeNodeProps,
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
    case ATLEAST_GATE:
      return (
        <NodeIcon
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          nodeType={NodeTypes.AtLeastGate}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "96 96 308 308",
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
    case HOUSE_EVENT:
      return (
        <NodeIcon
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          nodeType={NodeTypes.HouseEvent}
          iconProps={{ width: "30px", height: "100%", viewBox: "0 0 42 42" }}
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
    case ATLEAST_GATE:
      return ATLEAST_GATE_LABEL;
    case BASIC_EVENT:
      return BASIC_EVENT_LABEL;
    case TRANSFER_GATE:
      return TRANSFER_GATE_LABEL;
    case HOUSE_EVENT:
      return HOUSE_EVENT_LABEL;
    case NOT_GATE:
      return NOT_GATE_LABEL;
    default:
      return "";
  }
}

function FaultTreeNode(
  type: string,
): MemoExoticComponent<React.ComponentType<NodeProps<FaultTreeNodeProps>>> {
  return memo(({ id, selected, data }: NodeProps & FaultTreeNodeProps) => {
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
          {getNodeLabel(type)}

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

export { FaultTreeNode };
