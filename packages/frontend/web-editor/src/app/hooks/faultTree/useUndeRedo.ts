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

// https://redux.js.org/usage/implementing-undo-history
const useUndoRedo: UseUndoRedo = ({
  maxHistorySize = defaultOptions.maxHistorySize,
  enableShortcuts = defaultOptions.enableShortcuts,
} = defaultOptions) => {
  const { nodes, edges, past, future, setNodes, setEdges, setPast, setFuture } = useStore();
  const takeSnapshot = useCallback(() => {
    // push the current graph to the past state
    const pastItems: HistoryItem[] = [
      ...past.slice(past.length - maxHistorySize + 1, past.length),
      { nodes: cloneDeep(nodes), edges: cloneDeep(edges) },
    ];
    setPast(pastItems);

    // whenever we take a new snapshot, the redo operations need to be cleared to avoid state mismatches
    setFuture([]);
  }, [nodes, past, maxHistorySize, edges, setPast, setFuture]);

  const undo = useCallback(() => {
    // get the last state that we want to go back to
    const pastState: HistoryItem = past[past.length - 1];
    if (pastState) {
      // first we remove the state from the history
      setPast(past.slice(0, past.length - 1));
      // we store the current graph for the redo operation
      setFuture([...future, { nodes: nodes, edges: edges }]);
      // now we can set the graph to the past state
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
    // this effect is used to attach the global event handlers
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

    return () => {
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
