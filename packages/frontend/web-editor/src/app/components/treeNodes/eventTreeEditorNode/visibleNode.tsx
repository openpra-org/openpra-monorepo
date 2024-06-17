import { Handle, NodeProps, Position } from "reactflow";

import React from "react";
import {
  EuiFieldText,
  EuiSelect,
  EuiFormControlLayout,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonIcon,
  EuiIcon,
} from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";

import { UseEventTreeStore, UseGlobalStore } from "../../../zustand/Store";
import styles from "./styles/nodeTypes.module.css";

function VisibleNode({ id, data }: NodeProps) {
  const onClickCreate = UseEventTreeStore((state) => state.createNodeClick);
  const onClickDelete = UseEventTreeStore((state) => state.deleteNodeClick);
  const addSnapshot = UseEventTreeStore((state) => state.addSnapshot);
  const onNodeDataChange = UseEventTreeStore((state) => state.onNodeDataChange);

  const InputTextValueWidth = data.value
    ? 1 + data.value.length * 4 + "%"
    : "12%";
  const InputTextOptionWidth = data.option
    ? 1 + data.option.length * 4 + "%"
    : "12%";

  // Wrap the original onClickCreate in a new function that stops event propagation
  const handleCreateClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    addSnapshot();
    onClickCreate(id);
  };

  // Wrap the original onClickDelete in a new function that stops event propagation
  const handleDeleteClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    addSnapshot();
    onClickDelete(id);
  };
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onNodeDataChange(id, { ...data, value: e.target.value });
  };

  const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onNodeDataChange(id, { ...data, option: e.target.value });
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
          display: "none",
        }}
      />
      <div
        style={{
          width: data.width,
          height: 50,
        }}
      >
        <div>
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
          <EuiFormControlLayout
            style={{ height: "1.5rem", padding: 0, textAlign: "center" }}
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
                width: InputTextOptionWidth,
                marginLeft: "0.4rem",
              }}
              value={data.option || ""}
              onChange={handleOptionChange}
            />
          </EuiFormControlLayout>
        </div>

        {data.depth != 1 && (
          <EuiFlexGroup
            gutterSize={"xs"}
            justifyContent={"center"}
            alignItems={"center"}
          >
            <EuiFlexItem grow={false}>
              <EuiIcon size={"s"} type={"plus"} onClick={handleCreateClick} />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiIcon size={"s"} type={"minus"} onClick={handleDeleteClick} />
            </EuiFlexItem>
          </EuiFlexGroup>
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
