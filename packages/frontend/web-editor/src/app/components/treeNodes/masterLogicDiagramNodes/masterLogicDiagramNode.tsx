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
  BASIC_EVENT,
  BASIC_EVENT_LABEL,
  OR_GATE,
  OR_GATE_LABEL,
  SOURCE,
  TARGET,
} from "../../../../utils/constants";
import styles from "./styles/masterLogicDiagramNodeStyles.module.css";
import { MasterLogicDiagramNodeProps } from "./masterLogicDiagramNodeType";
import { MasterLogicDiagramNodeLabel } from "./masterLogicDiagramNodeLabel";

const stylesMap = styles as Record<string, string>;

export type FaultTreeNodeTypes = "andGate" | "orGate" | "basicEvent";

function getNodeIcon(
  type: string,
  id: string,
  selected: boolean | undefined,
  data: MasterLogicDiagramNodeProps,
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
    case BASIC_EVENT:
      return BASIC_EVENT_LABEL;
    default:
      return "";
  }
}

function MasterLogicDiagramNode(
  type: FaultTreeNodeTypes,
): MemoExoticComponent<React.ComponentType<NodeProps<MasterLogicDiagramNodeProps>>> {
  return memo(({ id, selected, data = {} }: NodeProps<MasterLogicDiagramNodeProps>) => {
    const { handleNodeDoubleClick } = UseNodeDoubleClick(id);
    const { handleMouseEnter, handleMouseLeave } = UseGrayedNodeHover(id);
    const { handleGrayedNodeClick } = UseGrayedNodeClick(id);
    const mouseEnterHandler = (): void => {
      handleMouseEnter(data.branchId);
    };
    const mouseLeaveHandler = (): void => {
      handleMouseLeave(data.branchId);
    };
    const grayedNodeClickHandler = async (): Promise<void> => {
      await handleGrayedNodeClick(data.branchId);
    };

    return (
      <div
        className={stylesMap.node_container}
        onDoubleClick={(event) => void handleNodeDoubleClick(event)}
        onClick={data.branchId !== undefined ? grayedNodeClickHandler : undefined}
        onMouseEnter={mouseEnterHandler}
        onMouseLeave={mouseLeaveHandler}
      >
        <div className={stylesMap.node_quantification}>0.05</div>
        <div
          className={
            data.isGrayed
              ? `${stylesMap.node} ${stylesMap.placeholder}`
              : `${stylesMap.node} ${selected ? stylesMap.selected : ``}`
          }
        >
          <MasterLogicDiagramNodeLabel label={getNodeLabel(type)} />
          <div className={stylesMap.node_id}>id: {id}</div>
          <Handle
            className={stylesMap.handle}
            type={TARGET}
            position={Position.Top}
            isConnectable={false}
          />
          <Handle
            className={stylesMap.handle}
            type={SOURCE}
            position={Position.Bottom}
            isConnectable={false}
          />
        </div>
        {getNodeIcon(type, id, selected, data as object)}
      </div>
    );
  });
}

export { MasterLogicDiagramNode };
