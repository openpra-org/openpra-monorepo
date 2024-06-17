import { Handle, NodeProps, Position, useUpdateNodeInternals } from "reactflow";
import React, { useContext } from "react";
import {
  EuiFlexGroup,
  EuiFormControlLayout,
  EuiIcon,
  EuiTextArea,
} from "@elastic/eui";

import { UseEventTreeStore, UseGlobalStore } from "../../../zustand/Store";
import { CustomStylesContext } from "../../../theme/ThemeProvider";
import styles from "./styles/nodeTypes.module.css";

function ColumnNode({ id, data }: NodeProps) {
  const onClickAddColumn = UseEventTreeStore((state) => state.createColClick);
  const onClickDeleteColumn = UseEventTreeStore(
    (state) => state.deleteColClick,
  );
  const addSnapshot = UseEventTreeStore((state) => state.addSnapshot);
  const onNodeDataChange = UseEventTreeStore((state) => state.onNodeDataChange);
  const onAllColumnHeightChange = UseEventTreeStore(
    (state) => state.onAllColumnHeightChange,
  );
  const saveGraph = UseEventTreeStore((state) => state.saveGraph);
  const columnNodeStyles = useContext(CustomStylesContext);
  const handleValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.removeAttribute("rows");
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;

    onNodeDataChange(id, {
      ...data,
      value: e.target.value,
    });
    const scrollHeight = textarea.scrollHeight ?? 0;

    const isIncreaseHeight = !!(scrollHeight && scrollHeight > data.height);

    if (scrollHeight && scrollHeight !== data.height) {
      onAllColumnHeightChange(scrollHeight, isIncreaseHeight);
    }
  };

  function getInitials(text: string): string {
    return text
      .split(" ") // Split the text into words based on spaces.
      .map((word) => (word[0] ? word[0].toUpperCase() : "")) // Take the first letter of each word, if it exists, and capitalize it.
      .join(""); // Join the first letters to form the initials.
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="a"
        style={{
          top: "50%",
          left: "20%",
          visibility: "hidden",
        }}
      />

      <div
        style={{
          visibility: data.hideText ? "hidden" : "visible",
          borderColor: "white",
          border: "1px solid",
          padding: "4px",
          fontSize: "0.6rem",
          width: data.width,
          height: data.height + 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <EuiFormControlLayout style={{ width: "75%" }}>
            <EuiTextArea
              onChange={handleValueChange}
              value={data.value}
              style={{
                textAlign: "center",
                fontSize: "0.9rem",
                background: "transparent",
                border: "none",
                overflow: "auto",
                outline: "none",
                boxShadow: "none",
                height: 46,
                padding: 4,
                scrollbarWidth: "none",
              }}
              resize="none"
            />
          </EuiFormControlLayout>
          {data.depth !== 1 && (
            <EuiFlexGroup
              gutterSize="s"
              alignItems={"center"}
              justifyContent={"center"}
              direction={"column"}
            >
              <EuiIcon
                size={"s"}
                type={"plus"}
                onClick={(evt) => {
                  addSnapshot();
                  onClickAddColumn(id);
                }}
                className={styles.addNodeButtonText}
              />

              <EuiIcon
                size={"s"}
                type={"minus"}
                onClick={(evt) => {
                  addSnapshot();
                  onClickDeleteColumn(id);
                }}
                className={styles.addNodeButtonText}
              />
            </EuiFlexGroup>
          )}
        </div>
      </div>
      <div style={{ width: "100%", textAlign: "center" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
          {getInitials(data.value)}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          right: "-1%",
          visibility: "hidden",
        }}
      />
    </>
  );
}

export default ColumnNode;
