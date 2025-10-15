import { Handle, NodeProps, Position } from "reactflow";
import React, { useRef, useLayoutEffect, useEffect } from "react";
import styles from "../../../components/treeNodes/bayesianNetwork/styles/nodeTypes.module.css";
import { UseStore } from "../../../hooks/bayesianNetwork/mindmap/useStore";

/**
 * Type definition for the props expected by the MindMapNode component,
 * specifically including a label for the node.
 */
export interface NodeData {
  label: string;
}

/**
 * A functional component that renders a single node within the mind map.
 * This node includes a draggable handle, an input field to edit the node's label,
 * and handles to connect to other nodes.
 *
 * @param  props - Props passed to the component, including the node's ID and its data.
 * @returns \{JSX.Element\} The rendered node element.
 */
const MindMapNode: React.FC<NodeProps<NodeData>> = ({ id, data }) => {
  const updateNodeLabel = UseStore((state) => state.updateNodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stylesMap = styles as Record<string, string>;

  // Adjust the width of the input based on the label length
  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.width = `${String(data.label.length * 8.8)}px`;
    }
  }, [data.label]);

  useEffect(() => {
    setTimeout(() => {
      if (wrapperRef.current) {
        wrapperRef.current.focus({ preventScroll: true });
      }
    }, 1);
  }, []);

  return (
    <div
      className={stylesMap.inputWrapper}
      tabIndex={0}
    >
      <div
        className={stylesMap.dragHandle}
        onMouseDown={(e): void => {
          e.stopPropagation();
        }}
      >
        {/* icon taken from grommet https://icons.grommet.io */}
        <svg viewBox="0 0 24 24">
          <path
            fill="#0984e3"
            stroke="#0984e3"
            strokeWidth="1"
            d="M15 5h2V3h-2v2zM7 5h2V3H7v2zm8 8h2v-2h-2v2zm-8 0h2v-2H7v2zm8 8h2v-2h-2v2zm-8 0h2v-2H7v2z"
          />
        </svg>
      </div>
      <div className={stylesMap.inputClass}>
        <input
          ref={inputRef}
          value={data.label}
          onChange={(evt): void => {
            updateNodeLabel(id, evt.target.value);
          }}
          className={stylesMap.input}
        />
      </div>
      <Handle
        type="source"
        position={Position.Top}
        className={stylesMap.sourceHandle}
      />
      <Handle
        type="target"
        position={Position.Top}
        className={stylesMap.targetHandle}
      />
    </div>
  );
};

export { MindMapNode };
