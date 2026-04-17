import { NodeProps, Position, Handle } from "reactflow";
import { memo } from "react";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import useDeleteColClick from "../../../hooks/eventTree/useDeleteColClick";
import { EuiTextArea } from "@elastic/eui";
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

function ColumnNode({ id, data }: NodeProps<ColumnNodeData>): JSX.Element {
  const onClickAddColumn = useCreateColClick(id);
  const onClickDeleteColumn = useDeleteColClick(id);
  const { allowAdd } = data;

  const canShowDeleteButton = (): boolean => {
    return !data.output && data.depth !== 1 && Boolean(data.allowDelete);
  };

  const hasButtons = allowAdd || canShowDeleteButton();

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
          borderColor: "white",
          borderLeft: "1px solid white",
          borderRight: "1px solid white",
          borderBottom: "1px solid white",
          padding: "4px",
          fontSize: "0.6rem",
          width: data.width,
          minHeight: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <EuiTextArea
          readOnly
          value={data.label}
          style={{
            fontSize: "0.6rem",
            background: "transparent",
            border: "none",
            padding: "4px",
            width: "100%",
            maxWidth: "100px",
            outline: "none",
            textAlign: "center",
            cursor: data.output ? "default" : "pointer",
          }}
          compressed={true}
          resize="none"
          rows={1}
          cols={1}
        />

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

        {hasButtons && (
          <div
            className={css.columnButtons}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "6px",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "2px",
            }}
          >
            {allowAdd && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClickAddColumn();
                }}
                className={css.addNodeButtonText}
                role="button"
                style={{ padding: "0 2px", cursor: "pointer" }}
              >
                +
              </span>
            )}
            {canShowDeleteButton() && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClickDeleteColumn();
                }}
                className={css.deleteNodeButtonText}
                role="button"
                style={{ padding: "0 2px", cursor: "pointer", marginLeft: 0 }}
              >
                −
              </span>
            )}
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
