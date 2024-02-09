import { Handle, Position } from "reactflow";
import { memo } from "react";

interface NodeProps {
  data: {
    // content: React.ReactNode;
    label?: string;
    width: number;
    hideText?: boolean;
  };
}

const columnNode: React.FC<NodeProps> = memo(({ data }) => {
  return (
    <>
      <Handle
        type={data.hideText ? "target" : "source"}
        position={Position.Left}
        id="a"
        style={{
          position: "absolute",
          top: "100%",
          left: "1%",
          visibility: "hidden",
        }}
      />
      {data.label && (
        <div
          style={{
            visibility: data.hideText ? "hidden" : "visible",
            borderColor: "white",
            borderLeft: "1px solid white",
            borderRight: "1px solid white",
            borderBottom: "1px solid white",
            padding: "4px",
            fontSize: "0.6rem",
            minWidth: data.width,
            minHeight: 30,
          }}
        >
          {data.label}
        </div>
      )}
      <Handle
        type={data.hideText ? "target" : "source"}
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
});

export default columnNode;
