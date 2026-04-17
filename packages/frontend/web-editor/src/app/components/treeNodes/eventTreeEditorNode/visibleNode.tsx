import { Handle, NodeProps, Position } from "reactflow";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";
import styles from "./styles/nodeTypes.module.css";
const css = styles as Record<string, string>;

export interface VisibleNodeData {
  width: number;
  depth: number;
  label?: string;
  output?: boolean;
  isSequenceId?: boolean;
  inputDepth?: number;
  outputDepth?: number;
}

function VisibleNode({ id, data }: NodeProps<VisibleNodeData>): JSX.Element {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);

  return (
    <div>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{ position: "absolute", top: "50%", left: "50%", visibility: "hidden" }}
      />
      <div style={{ width: data.width, height: 40, position: "relative" }}>
        {data.depth === 1 && data.label && (
          <span
            style={{
              position: "absolute",
              top: "50%",
              right: "calc(50% + 8px)",
              transform: "translateY(-50%)",
              fontSize: "0.65rem",
              fontWeight: 600,
              color: "#6b7280",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {data.label}
          </span>
        )}
        {data.depth !== 1 && (
          <>
            <p
              onClick={onClickCreate}
              className={css.addNodeButtonText}
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                margin: 0,
                lineHeight: 1,
              }}
            >
              +
            </p>
            <p
              onClick={onClickDelete}
              className={css.addNodeButtonText}
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                margin: 0,
                lineHeight: 1,
              }}
            >
              −
            </p>
          </>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{ position: "absolute", top: "50%", right: "50%", visibility: "hidden" }}
      />
    </div>
  );
}

export default VisibleNode;
