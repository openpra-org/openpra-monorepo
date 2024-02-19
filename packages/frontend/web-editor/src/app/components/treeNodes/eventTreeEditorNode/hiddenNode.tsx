import { Handle, NodeProps, Position } from "reactflow";
import { memo } from "react";

export default memo(() => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          left: "85%",
          visibility: "hidden",
          transform: "translate(100%,-50%)",
        }}
      />
      <div
        style={{
          borderColor: "white",
          borderLeft: "1px solid white",
          borderRight: "1px solid white",
          borderBottom: "1px solid white",
          borderTop: "1px solid white",
          maxWidth: 40,
        }}
      >
        <p style={{ visibility: "hidden" }}>aawdawd.</p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          position: "absolute",
          top: "50%",
          left: "0%",
          visibility: "hidden",
          transform: "translate(0%,-50%)",
        }}
      />
    </>
  );
});
