import { Handle, NodeProps, Position } from "reactflow";
import React, { useState, useEffect } from "react";
import { EuiText, EuiSelect } from "@elastic/eui";
import { useCategoryContext } from "../../../hooks/eventTree/useCreateReleaseCategory";
import styles from "./styles/nodeTypes.module.css";

// Counter for sequence IDs
let sequenceCounter = 1;
const usedIds = new Set();

function OutputNode({ id, data }: NodeProps) {
  const { categories, addCategory } = useCategoryContext();
  const [releaseCategory, setReleaseCategory] = useState(data.label);
  const [sequenceId, setSequenceId] = useState("");

  // Initialize sequence ID on mount
  useEffect(() => {
    if (data.isSequenceId && !sequenceId) {
      // If this ID hasn't been used yet
      if (!usedIds.has(id)) {
        setSequenceId(`IE-${sequenceCounter++}`);
        usedIds.add(id);
      }
    }
  }, [id, data.isSequenceId]);

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

  // Format the display label
  const getDisplayLabel = () => {
    if (data.isSequenceId) {
      return sequenceId;
    }
    return data.label;
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
          <EuiText style={{ fontSize: "0.7rem" }}>{getDisplayLabel()}</EuiText>
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

// Function to reset counter
export const resetSequenceCounter = () => {
  usedIds.clear();
  sequenceCounter = 1;
};

export default OutputNode;
