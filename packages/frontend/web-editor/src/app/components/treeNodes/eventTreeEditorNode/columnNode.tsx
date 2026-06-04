import { NodeProps, Position, Handle } from "reactflow";
import { memo } from "react";
import styles from "./styles/nodeTypes.module.css";
const css = styles as Record<string, string>;
export interface ColumnNodeData {
  label: string;
  width: number;
  depth: number;
  output?: boolean;
  allowAdd?: boolean;
  allowDelete?: boolean;
  hideText?: boolean;
  isSequenceId?: boolean;
  faultTreeId?: string;
  faultTreeLabel?: string;
  frequency?: number;
}
function ColumnNode({ data }: NodeProps<ColumnNodeData>): JSX.Element {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="a"
        style={{ position: "absolute", top: "100%", left: "1%", visibility: "hidden" }}
      />

      <div
        className={!data.output ? css.clickableColumn : undefined}
        style={{
          visibility: data.hideText ? "hidden" : "visible",
          borderLeft: "1px solid white",
          borderRight: "1px solid white",
          borderBottom: "1px solid white",
          fontSize: "0.6rem",
          width: data.width,
          minHeight: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          left: "50%",
          transform: "translateX(-50%)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            textAlign: "center",
            padding: "4px",
            width: "100%",
            cursor: data.output ? "default" : "pointer",
            lineHeight: 1.3,
          }}
        >
          {data.label}
        </div>

        {data.allowAdd && !data.output && (
          <div
            style={{
              fontSize: "0.55rem",
              color: data.faultTreeId ? "#006BB4" : "#98a2b3",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100px",
              padding: "2px 4px",
              borderTop: "1px solid #e9edf2",
              width: "100%",
              fontStyle: data.faultTreeId ? "normal" : "italic",
            }}
            title={data.faultTreeId ? (data.faultTreeLabel ?? data.faultTreeId) : "No fault tree linked"}
          >
            {data.faultTreeId ? (data.faultTreeLabel ?? data.faultTreeId) : "—"}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{ position: "absolute", top: "100%", right: "-1%", visibility: "hidden" }}
      />
    </>
  );
}
export default memo(ColumnNode);
