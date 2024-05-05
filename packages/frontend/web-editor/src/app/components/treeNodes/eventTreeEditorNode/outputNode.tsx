import { Handle, NodeProps, Position } from "reactflow";

import React from "react";
import { EuiFieldText, EuiFormControlLayout, EuiText } from "@elastic/eui";

import styles from "./styles/nodeTypes.module.css";

function OutputNode({ id, data }: NodeProps) {
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    data.onNodeDataChange(id, { ...data, value: e.target.value });
  };
  const InputTextValueWidth = data.value
    ? 1 + data.value.length * 4 + "%"
    : "12%";
  return (
    <div>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          left: "0%",

          visibility: "hidden",
        }}
      />
      <div
        style={{
          width: data.width,
          height: 50,
          textAlign: "center",
        }}
      >
        <div className={styles.outputNode}>
          <EuiFormControlLayout
            style={{
              height: "2rem",
              textAlign: "center",
              padding: 0,
            }}
          >
            <EuiFieldText
              maxLength={20}
              compressed
              style={{
                fontSize: "0.7rem",
                height: "1rem",
                resize: "none",
                border: "none",
                outline: "none",
                boxShadow: "none",
                backgroundColor: "transparent",
                overflow: "hidden",
                padding: 0,
                width: InputTextValueWidth,
                marginTop: "0.5rem",
                marginLeft: "0.4rem",
              }}
              value={data.value || "0.5"}
              onChange={handleValueChange}
            />
          </EuiFormControlLayout>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          position: "absolute",
          top: "50%",
          right: "0%",
          visibility: "hidden",
        }}
      />
    </div>
  );
}

export default OutputNode;
