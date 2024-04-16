import { Handle, NodeProps, Position } from "reactflow";

import React from "react";
import { EuiFieldText, EuiSelect, EuiFormControlLayout } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";

import styles from "./styles/nodeTypes.module.css";

const options = [
  { value: "yes", text: "Yes" },
  { value: "no", text: "No" },
  { value: "maybe", text: "Maybe" },
];

function VisibleNode({ id, data }: NodeProps) {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);

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
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    data.onNodeDataChange(id, { ...data, value: e.target.value });
  };

  const handleOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    data.onNodeDataChange(id, { ...data, option: e.target.value });
  };
  return (
    <div className={styles.container}>
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
          height: 50,
        }}
      >
        <div style={{ display: "flex" }}>
          <EuiFormControlLayout>
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
                marginTop: "0.7rem",
                marginLeft: "0.4rem",
                width: "80%",
              }}
              value={data.value || "0.55"}
              onChange={handleValueChange}
            />
          </EuiFormControlLayout>
          <EuiFormControlLayout style={{ width: "80%" }}>
            <EuiSelect
              id={id}
              compressed
              style={{
                fontSize: "0.7rem",

                border: "none",
                outline: "none",
                boxShadow: "none",
                backgroundColor: "transparent",
                overflow: "hidden",
                padding: 0,

                borderRadius: 0,
              }}
              options={options}
              value={data.option}
              onChange={handleOptionChange}
            />
          </EuiFormControlLayout>
        </div>
        {data.depth != 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              style={{ marginRight: "0.2rem", fontSize: "1.2rem" }}
              onClick={handleCreateClick}
              className={styles.addNodeButtonText}
            >
              +
            </p>
            <p
              style={{ fontSize: "1.2rem" }}
              onClick={handleDeleteClick}
              className={styles.addNodeButtonText}
            >
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
