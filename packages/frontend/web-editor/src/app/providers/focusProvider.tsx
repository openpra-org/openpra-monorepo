import { NodeProps } from "reactflow";
import { createContext, ReactNode, useContext, useState } from "react";

interface NodeFocusType {
  focusNodeId: NodeProps["id"] | undefined;
  setFocus: (nodeId: NodeProps["id"]) => void;
  reset: () => void;
}

const FocusContext = createContext<NodeFocusType | undefined>(undefined);

export const UseFocusContext = (): NodeFocusType => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("UseFocusContext must be used within a FocusProvider");
  }
  return context;
};

export const FocusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [focusNodeId, setFocus] = useState<string | undefined>(undefined);

  const reset = (): void => {
    setFocus(undefined);
  };

  return <FocusContext.Provider value={{ focusNodeId, setFocus, reset }}>{children}</FocusContext.Provider>;
};
