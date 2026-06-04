import { useCallback, useEffect } from "react";
import { cloneDeep } from "lodash";
import { HistoryItem, useStore } from "../../store/faultTreeStore";
interface UseUndoRedoOptions {
  maxHistorySize: number;
  enableShortcuts: boolean;
}
type UseUndoRedo = (options?: UseUndoRedoOptions) => {
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  canUndo: boolean;
  canRedo: boolean;
};
const defaultOptions: UseUndoRedoOptions = {
  maxHistorySize: 100,
  enableShortcuts: true,
};
const useUndoRedo: UseUndoRedo = ({
  maxHistorySize = defaultOptions.maxHistorySize,
  enableShortcuts = defaultOptions.enableShortcuts,
} = defaultOptions) => {
  const { nodes, edges, past, future, setNodes, setEdges, setPast, setFuture } = useStore();
  const takeSnapshot = useCallback(() => {
    const pastItems: HistoryItem[] = [
      ...past.slice(past.length - maxHistorySize + 1, past.length),
      { nodes: cloneDeep(nodes), edges: cloneDeep(edges) },
    ];
    setPast(pastItems);
    setFuture([]);
  }, [nodes, past, maxHistorySize, edges, setPast, setFuture]);
  const undo = useCallback(() => {
    const pastState: HistoryItem = past[past.length - 1];
    if (pastState) {
      setPast(past.slice(0, past.length - 1));
      setFuture([...future, { nodes: nodes, edges: edges }]);
      setNodes(pastState.nodes);
      setEdges(pastState.edges);
    }
  }, [past, setPast, setFuture, future, nodes, edges, setNodes, setEdges]);
  const redo = useCallback(() => {
    const futureState = future[future.length - 1];
    if (futureState) {
      setFuture(future.slice(0, future.length - 1));
      setPast([...past, { nodes: nodes, edges: edges }]);
      setNodes(futureState.nodes);
      setEdges(futureState.edges);
    }
  }, [future, setFuture, setPast, past, nodes, edges, setNodes, setEdges]);
  useEffect(() => {
    if (!enableShortcuts) {
      return;
    }
    const keyDownHandler = (event: KeyboardEvent): void => {
      if (event.key === "z" && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        redo();
      } else if (event.key === "z" && (event.ctrlKey || event.metaKey)) {
        undo();
      }
    };
    document.addEventListener("keydown", keyDownHandler);
    return (): void => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  }, [undo, redo, enableShortcuts]);
  return {
    undo,
    redo,
    takeSnapshot,
    canUndo: !past.length,
    canRedo: !future.length,
  };
};
export { useUndoRedo };
