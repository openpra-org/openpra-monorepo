import { Toast } from "@elastic/eui/src/components/toast/global_toast_list";
import { createContext, ReactNode, useContext, useState } from "react";

interface ToastContextType {
  toasts: Toast[];
  addToast: (newToast: Toast) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const UseToastContext = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (newToast: Toast): void => {
    setToasts([newToast]);
  };

  const clearToasts = (): void => {
    setToasts([]);
  };

  return <ToastContext.Provider value={{ toasts, addToast, clearToasts }}>{children}</ToastContext.Provider>;
};
