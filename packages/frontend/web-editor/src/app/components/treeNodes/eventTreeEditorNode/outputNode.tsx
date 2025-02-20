import { Handle, NodeProps, Position } from "reactflow";
import React, { useState } from "react";
import { EuiText, EuiSelect } from "@elastic/eui";
import { useCategoryContext } from "../../../hooks/eventTree/useCreateReleaseCategory";
import styles from "./styles/nodeTypes.module.css";

function OutputNode({ id, data }: NodeProps) {
  const { categories, addCategory } = useCategoryContext();
  const [releaseCategory, setReleaseCategory] = useState(data.label);

  // Static "Create new" option
  const staticOptions = [{ value: "Create new", text: "Create new .." }];

  // Handle category selection
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "Create new") {
      const newCategory = prompt("Enter new Release Category:");
      if (newCategory) {
        addCategory(newCategory); // Add new category globally
        setReleaseCategory(newCategory); // Set selected category
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
            options={[...categories, ...staticOptions]}
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
