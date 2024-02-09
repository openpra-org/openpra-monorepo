import { Handle, Position } from "reactflow";
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
          right: "50%",
          visibility: "hidden",
          transform: "translate(100%,-50%)",
        }}
      />
      <p style={{ visibility: "hidden" }}>.</p>
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          position: "absolute",
          top: "50%",
          right: "50%",
          visibility: "hidden",
          transform: "translate(0%,-50%)",
        }}
      />
    </>
  );
});
