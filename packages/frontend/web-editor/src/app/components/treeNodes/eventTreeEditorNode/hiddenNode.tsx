import { Handle, NodeProps, Position } from "reactflow";
import { memo } from "react";
import React from "react";

const hiddenNode: React.FC<NodeProps> = memo(({ data }) => (
  <div>
    <Handle
      type="target"
      position={Position.Left}
      id="b"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",

        visibility: "hidden",
      }}
    />
    <div
      style={{
        borderColor: "white",
        // borderLeft: "1px solid white",
        // borderRight: "1px solid white",
        // borderBottom: "1px solid white",
        // borderTop: "1px solid white",
        width: 140,
        height: 40,
      }}
    ></div>
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
));

export default hiddenNode;
