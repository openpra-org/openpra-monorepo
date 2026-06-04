import { Handle, Node, NodeProps, Position, useReactFlow } from "reactflow";
import { memo, MemoExoticComponent, useCallback, useEffect, useMemo, useState } from "react";
import cx from "classnames";
import { EuiTextArea, useEuiFontSize } from "@elastic/eui";
import { debounce } from "lodash";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { UseNodeClick } from "../../../hooks/eventSequence/useNodeClick";
import { GetESToast } from "../../../../utils/treeUtils";
import { UseToastContext } from "../../../providers/toastProvider";
import { EventSequenceNodeProps, EventSequenceNodeTypes } from "./eventSequenceNodeType";
import styles from "./styles/nodeTypes.module.css";
const stylesMap = styles as Record<string, string>;
function GetNodeElements(id: NodeProps["id"], type: string, data: EventSequenceNodeProps): JSX.Element {
  let handles: JSX.Element;
  const { getNodes, setNodes } = useReactFlow();
  const [nodeLabel, setNodeLabel] = useState(data.label ?? "");
  const { addToast } = UseToastContext();
  const fontSize = useEuiFontSize("xs").fontSize;
  const updateHandler = useMemo(
    () =>
      debounce((newLabel: string): void => {
        setNodes(
          getNodes().map((n: Node<EventSequenceNodeProps>) => {
            if (n.id === id) {
              n.data.label = newLabel;
            }
            return n;
          }),
        );
        GraphApiManager.updateESLabel(id, newLabel, "node")
          .then((r) => {
            if (!r) {
              addToast(GetESToast("danger", "Something went wrong"));
            }
          })
          .catch(() => {
            addToast(GetESToast("danger", "Something went wrong"));
          });
      }, 500),
    [getNodes, id, setNodes, addToast],
  );
  useEffect((): (() => void) => {
    return () => {
      updateHandler.cancel();
    };
  }, [updateHandler]);
  const onNodeLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const newLabel = e.target.value;
      setNodeLabel(newLabel);
      updateHandler(newLabel);
    },
    [updateHandler],
  );
  switch (type) {
    case "initiating":
      handles = (
        <Handle
          className={stylesMap.handle}
          type="source"
          position={Position.Right}
          isConnectable={false}
        />
      );
      break;
    case "functional":
    case "description":
    case "intermediate":
      handles = (
        <>
          <Handle
            className={stylesMap.handle}
            type="target"
            position={Position.Left}
            isConnectable={false}
          />
          <Handle
            className={stylesMap.handle}
            type="source"
            position={Position.Right}
            isConnectable={false}
          />
        </>
      );
      break;
    case "end":
    case "transfer":
    case "undeveloped":
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
      <EuiTextArea
        className={cx(stylesMap.node_label)}
        style={{ fontSize: fontSize }}
        placeholder="Node Label"
        value={nodeLabel}
        fullWidth={true}
        onChange={onNodeLabelChange}
        resize={"none"}
        readOnly={data.tentative === true || data.branchId !== undefined}
        title={nodeLabel}
      />
      {handles}
    </>
  );
}
function GetNode(
  id: NodeProps["id"],
  type: EventSequenceNodeTypes,
  selected: boolean,
  data: EventSequenceNodeProps,
  className: string,
  testId: string,
  borderClassName: string | undefined = undefined,
): JSX.Element {
  const border = selected && !data.tentative ? "#02337c" : "#0984e3";
  const onClick = UseNodeClick(id, data);
  const nodeElements: JSX.Element = GetNodeElements(id, type, data);
  switch (type) {
    case "initiating":
    case "functional":
    case "description":
      return (
        <div
          className={className}
          data-testid={testId}
          onClick={onClick}
          style={{ position: "relative", borderColor: border }}
        >
          {nodeElements}
        </div>
      );
    case "intermediate":
    case "end":
    case "transfer":
    case "undeveloped":
      return (
        <>
          <div
            className={borderClassName}
            style={{ borderColor: border }}
          ></div>
          <div
            className={className}
            data-testid={testId}
            onClick={onClick}
            style={{
              position: "relative",
            }}
          >
            {nodeElements}
          </div>
        </>
      );
    default:
      throw new Error("Node Type invalid");
  }
}
function GetNodeContainer(
  nodeComponent: JSX.Element,
  className: string,
  style: boolean,
  tentative: boolean | undefined,
): JSX.Element {
  return style ?
      <div
        className={className}
        style={{
          opacity: tentative ? "0.5" : "1",
        }}
      >
        {nodeComponent}
      </div>
    : <div className={className}>{nodeComponent}</div>;
}
function GetNodeComponent(
  id: NodeProps["id"],
  type: EventSequenceNodeTypes,
  selected: boolean,
  data: EventSequenceNodeProps,
): JSX.Element {
  switch (type) {
    case "initiating":
      return GetNodeContainer(
        <>
          {GetNode(id, type, selected, data, cx(stylesMap.node, stylesMap.initiating_node), "initiating-event-node")}
          <div className={cx(stylesMap.line)} />
        </>,
        cx(stylesMap.node_container),
        false,
        data.tentative,
      );
    case "functional":
      return GetNodeContainer(
        GetNode(id, type, selected, data, cx(stylesMap.node, stylesMap.functional_node), "functional-node"),
        cx(stylesMap.node_container),
        true,
        data.tentative,
      );
    case "description":
      return GetNodeContainer(
        GetNode(id, type, selected, data, cx(stylesMap.node, stylesMap.description_node), "description-node"),
        cx(stylesMap.node_container),
        true,
        data.tentative,
      );
    case "intermediate":
      return GetNodeContainer(
        GetNode(
          id,
          type,
          selected,
          data,
          cx(stylesMap.node, stylesMap.inter_state_node),
          "intermediate-state-node",
          cx(stylesMap.inter_state_node_border),
        ),
        cx(stylesMap.inter_state_node_container),
        true,
        data.tentative,
      );
    case "end":
      return GetNodeContainer(
        GetNode(
          id,
          type,
          selected,
          data,
          cx(stylesMap.node, stylesMap.end_state_node),
          "end-state-node",
          cx(stylesMap.end_state_node_border),
        ),
        cx(stylesMap.end_state_node_container),
        true,
        data.tentative,
      );
    case "transfer":
      return GetNodeContainer(
        GetNode(
          id,
          type,
          selected,
          data,
          cx(stylesMap.node, stylesMap.transfer_state_node),
          "transfer-state-node",
          cx(stylesMap.transfer_state_node_border),
        ),
        cx(stylesMap.transfer_state_node_container),
        true,
        data.tentative,
      );
    case "undeveloped":
      return GetNodeContainer(
        GetNode(
          id,
          type,
          selected,
          data,
          cx(stylesMap.node, stylesMap.undeveloped_node),
          "undeveloped-node",
          cx(stylesMap.undeveloped_node_border),
        ),
        cx(stylesMap.undeveloped_node_container),
        true,
        data.tentative,
      );
    default:
      throw new Error("Node Type invalid");
  }
}
function EventSequenceNode(
  type: EventSequenceNodeTypes,
): MemoExoticComponent<React.ComponentType<NodeProps<EventSequenceNodeProps>>> {
  return memo(
    ({ id, selected, data = {} }: NodeProps<EventSequenceNodeProps>): JSX.Element =>
      GetNodeComponent(id, type, selected, data),
  );
}
export { EventSequenceNode };
