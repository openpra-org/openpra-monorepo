import { Handle, NodeProps, Position } from "reactflow";
import { memo } from "react";

export default memo(() => (
  <div>
    <Handle
      type="target"
      position={Position.Left}
      id="b"
      style={{
        position: "absolute",
        top: "50%",

        transform: "translate(80%,-50%)",
        visibility: "hidden",
      }}
    />
    <div
      style={{
        borderColor: "white",
        borderLeft: "1px solid white",
        borderRight: "1px solid white",
        borderBottom: "1px solid white",
        borderTop: "1px solid white",
        width: 60,
        height: 40,
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
        left: "-15%",
        visibility: "hidden",
        transform: "translate(0%,-50%)",
      }}
    />
  </div>
));
