import { Handle, NodeProps, Position } from "reactflow";
import React, { useState } from "react";
import { EuiText, EuiSelect } from "@elastic/eui";

import styles from "./styles/nodeTypes.module.css";

function OutputNode({ id, data }: NodeProps) {
  const [releaseCategory, setReleaseCategory] = useState(data.label);

  const categories = [
    { value: "Category A", text: "Category A" },
    { value: "Category B", text: "Category B" },
    { value: "Create New", text: "Create New..." },
  ];

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "Create New") {
      const newCategory = prompt("Enter new category:");
      if (newCategory) {
        categories.push({ value: newCategory, text: newCategory });
        setReleaseCategory(newCategory);
      }
    } else {
      setReleaseCategory(value);
    }
  };
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
          height: 40,
          textAlign: "center",
          border: "1px solid black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "5px",
          boxSizing: "border-box",
        }}
      >
        {/* Show dropdown for Release Category */}
        {data.label === "Category A" || data.label === "Category B" ? (
          <EuiSelect
            options={categories}
            value={releaseCategory}
            onChange={handleCategoryChange}
            compressed={true} // Makes dropdown smaller
            style={{
              width: "115px", // Smaller dropdown width
              height: "30px", // Smaller dropdown height
              fontSize: "0.7rem", // Smaller font size
              padding: "0 5px",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <EuiText style={{ fontSize: "0.7rem" }}>{data.label}</EuiText>
        )}
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
