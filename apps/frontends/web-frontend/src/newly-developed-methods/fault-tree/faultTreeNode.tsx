import { JSX, memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { type FtNodeData } from "./faultTreeTypes";
import { GateIcon } from "./nodeIcons";

const GATE_LABEL: Record<string, string> = { AND: "AND", OR: "OR", NOT: "NOT", ATLEAST: "K / N" };

function tagFor(data: FtNodeData): string {
  if (data.type === "GATE") {
    if (data.gate === "ATLEAST" && data.k !== undefined) return `${data.k} / N`;
    return GATE_LABEL[data.gate ?? "OR"] ?? "OR";
  }
  return data.type.charAt(0) + data.type.slice(1).toLowerCase();
}

function FaultTreeNodeImpl({ data, selected }: NodeProps<FtNodeData>): JSX.Element {
  const isGate = data.type === "GATE";
  return (
    <div className={`ftnode ftnode--${data.type.toLowerCase()}${selected ? " is-sel" : ""}`}>
      <Handle type="target" position={isGate ? Position.Top : Position.Left} isConnectable={false} className="ftnode__handle" />
      <div className="ftnode__top">
        <span className="ftnode__symbol"><GateIcon data={data} /></span>
        <span className="ftnode__tag">{tagFor(data)}</span>
      </div>
      <div className="ftnode__label">{data.label}</div>
      {data.badges !== undefined && data.badges.length > 0 && (
        <div className="ftnode__badges">
          {data.badges.map((b) => <span key={b} className="ftnode__badge">{b}</span>)}
        </div>
      )}
      {isGate && <Handle type="source" position={Position.Bottom} isConnectable={false} className="ftnode__handle" />}
    </div>
  );
}

export const FaultTreeNode = memo(FaultTreeNodeImpl);
