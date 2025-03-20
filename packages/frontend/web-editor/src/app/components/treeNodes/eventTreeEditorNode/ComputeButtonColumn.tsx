import { NodeProps } from "reactflow";
import React from "react";
import { EuiButton } from "@elastic/eui";

function ComputeButtonColumn({ data }: NodeProps) {
  const handleClick = () => {
    console.log("Button Column Clicked!");
    // Add functionality later
  };

  return (
    <div
      style={{
        width: data.width * 0.8,
        height: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        left: "60%",
        transform: "translateX(-50%) translateY(50%)",
      }}
    >
      <EuiButton
        size="s"
        onClick={handleClick}
        style={{
          fontSize: "0.75rem",
          padding: "4px 4px",
          minWidth: "120px",
        }}
      >
        Compute Frequency
      </EuiButton>
    </div>
  );
}

export default ComputeButtonColumn;
