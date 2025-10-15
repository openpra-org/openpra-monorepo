import React, { DragEvent } from "react";
import rawStyles from "./styles.module.css";
const styles: Record<string, string> = rawStyles as Record<string, string>;
function TreeEditorSideNav(): JSX.Element {
  type DraggableNodeData = Record<string, unknown>;
  const onDragStart = (nodeData: DraggableNodeData): ((event: DragEvent) => void) => {
    return (event: DragEvent): void => {
      const dataString = JSON.stringify(nodeData);
      event.dataTransfer.setData("application/reactflow", dataString);
    };
  };
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarLabel}>You can drag nodes from the sidebar and drop them on another node</div>
      <div>
        <div
          onDragStart={onDragStart({})}
          draggable
          className={styles.sidebarNode}
        >
          Node A
        </div>
        <div
          onDragStart={onDragStart({ id: "B" })}
          draggable
          className={styles.sidebarNode}
        >
          Node B
        </div>
        <div
          onDragStart={onDragStart({ id: "C" })}
          draggable
          className={styles.sidebarNode}
        >
          Node C
        </div>
      </div>
    </div>
  );
}

export { TreeEditorSideNav };
