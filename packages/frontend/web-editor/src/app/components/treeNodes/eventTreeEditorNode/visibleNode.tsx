import { Handle, NodeProps, Position } from "reactflow";

import React from "react";
import { EuiText } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";
import useOnNodeClick from "../../../hooks/eventTree/useOnNodeClick";
import styles from "./styles/nodeTypes.module.css";

function VisibleNode({ id, data }: NodeProps) {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);
  const onClickDeleteSubtree = useOnNodeClick(id);

  // Wrap the original onClickCreate in a new function that stops event propagation
  const handleCreateClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onClickCreate();
  };

  // Wrap the original onClickDelete in a new function that stops event propagation
  const handleDeleteClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onClickDelete();
  };

  return (
    <div
      className={data.isTentative && styles.container}
      onClick={onClickDeleteSubtree}
      style={{ opacity: data.isTentative ? "0.5" : "1" }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",

          visibility: "hidden",
        }}
      />
      <div
        style={{
          width: data.width,
          height: 40,
          textAlign: "center",
        }}
      >
        <div className={styles.inputNode}>
          <EuiText
            style={{ fontSize: "0.7rem", height: "1.2rem", resize: "none" }}
          >
            0.55
          </EuiText>
        </div>

        <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>Yes</EuiText>

        {data.depth != 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p onClick={handleCreateClick} className={styles.addNodeButtonText}>
              +
            </p>
            <p onClick={handleDeleteClick} className={styles.addNodeButtonText}>
              -
            </p>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          position: "absolute",
          top: "50%",
          right: "50%",
          visibility: "hidden",
        }}
      />
    </div>
  );
}

export default VisibleNode;
