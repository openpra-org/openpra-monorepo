import { NodeProps, Position, Handle, useStore } from "reactflow";
import { memo } from "react";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import useDeleteColClick from "../../../hooks/eventTree/useDeleteColClick";
import styles from "./styles/nodeTypes.module.css";
const css = styles as Record<string, string>;
export interface ColumnActionsNodeData {
  width: number;
  label?: string;
}
interface ColumnNodeDataShape {
  depth: number;
  allowAdd?: boolean;
  output?: boolean;
}
function ColumnActionsNode(_props: NodeProps<ColumnActionsNodeData>): JSX.Element {
  const rightmostFEId = useStore((s) => {
    const feNodes = Array.from(s.nodeInternals.values()).filter(
      (n) =>
        n.type === "columnNode" && (n.data as ColumnNodeDataShape).allowAdd && !(n.data as ColumnNodeDataShape).output,
    );
    const maxDepth = feNodes.reduce((max, n) => Math.max(max, (n.data as ColumnNodeDataShape).depth ?? 0), 0);
    return feNodes.find((n) => (n.data as ColumnNodeDataShape).depth === maxDepth)?.id ?? "";
  });
  const onClickAdd = useCreateColClick(rightmostFEId);
  const onClickDelete = useDeleteColClick(rightmostFEId);
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="a"
        style={{ visibility: "hidden" }}
      />
      <div
        style={{
          display: "inline-flex",
          flexDirection: "row",
          gap: "8px",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          fontSize: "0.6rem",
          minHeight: 30,
          padding: "4px 12px",
          background: "transparent",
          position: "relative",
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          boxSizing: "border-box",
        }}
      >
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClickAdd();
          }}
          className={css.addNodeButtonText}
          role="button"
          style={{ cursor: "pointer" }}
        >
          +
        </span>
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClickDelete();
          }}
          className={css.deleteNodeButtonText}
          role="button"
          style={{ cursor: "pointer" }}
        >
          −
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{ visibility: "hidden" }}
      />
    </>
  );
}
export default memo(ColumnActionsNode);
