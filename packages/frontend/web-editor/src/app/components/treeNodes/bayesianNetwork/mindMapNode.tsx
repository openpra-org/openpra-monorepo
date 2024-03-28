import { Handle, NodeProps, Position } from "reactflow";
import React, { useRef, useLayoutEffect, useEffect, useState } from "react";
import styles from "../../../components/treeNodes/bayesianNetwork/styles/nodeTypes.module.css";
import useStore from "../../../hooks/bayesianNetwork/mindmap/useStore";

export type NodeData = {
  label: string;
};

function MindMapNode({ id, data }: NodeProps<NodeData>) {
  const updateNodeLabel = useStore((state) => state.updateNodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  // Adjust the width of the input based on the label length
  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.width = `${data.label.length * 8.8}px`;
    }
  }, [data.label]);

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 1);
  }, []);

  return (
    <div className={`${styles.inputWrapper} `} style={{ position: "relative" }}>
      {/*<div className={styles.inputWrapper} style={{ position: "relative" }}>*/}
      <div
        className={styles.dragHandle}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        {/* icon taken from grommet https://icons.grommet.io */}
        <svg viewBox="0 0 24 24">
          <path
            fill="white"
            stroke="white"
            strokeWidth="1"
            d="M15 5h2V3h-2v2zM7 5h2V3H7v2zm8 8h2v-2h-2v2zm-8 0h2v-2H7v2zm8 8h2v-2h-2v2zm-8 0h2v-2H7v2z"
          />
        </svg>
      </div>
      <div>
        <input
          ref={inputRef}
          value={data.label}
          onChange={(evt) => {
            updateNodeLabel(id, evt.target.value);
          }}
          className={styles.input}
        />
      </div>
      <Handle
        type="source"
        position={Position.Top}
        className={styles.sourceHandle}
      />
      <Handle
        type="target"
        position={Position.Top}
        className={styles.targetHandle}
      />
    </div>
  );
}

export default MindMapNode;
