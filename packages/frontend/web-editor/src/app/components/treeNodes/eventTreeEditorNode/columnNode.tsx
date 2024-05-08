import { Handle, NodeProps, Position, useUpdateNodeInternals } from "reactflow";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormControlLayout,
  EuiIcon,
  EuiSpacer,
  EuiText,
  EuiTextArea,
} from "@elastic/eui";
import { set } from "lodash";

import useDeleteColClick from "../../../hooks/eventTree/useDeleteColClick";
import { UseGlobalStore } from "../../../zustand/Store";
import styles from "./styles/nodeTypes.module.css";

function ColumnNode({ id, data }: NodeProps) {
  const onClickAddColumn = UseGlobalStore((state) => state.createColClick);
  const onClickDeleteColumn = UseGlobalStore((state) => state.deleteColClick);
  const addSnapshot = UseGlobalStore((state) => state.addSnapshot);

  const handleValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.removeAttribute("rows");
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;

    data.onNodeDataChange(id, {
      ...data,
      value: e.target.value,
    });
    const scrollHeight = textarea.scrollHeight ?? 0;

    const isIncreaseHeight = scrollHeight && scrollHeight > data.height;

    if (scrollHeight && scrollHeight !== data.height) {
      data.onAllColumnHeightChange(scrollHeight, isIncreaseHeight);
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
          position: "absolute",
          top: "100%",
          left: "1%",
          visibility: "hidden",
        }}
      />

      <div
        style={{
          visibility: data.hideText ? "hidden" : "visible",
          borderColor: "white",
          borderLeft: "1px solid",
          borderRight: "1px solid",
          borderBottom: "1px solid",
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
          top: "100%",
          right: "-1%",
          visibility: "hidden",
        }}
      />
    </>
  );
}

export default ColumnNode;
