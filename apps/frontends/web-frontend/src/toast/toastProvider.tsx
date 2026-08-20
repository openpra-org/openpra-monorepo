import { createContext, ReactNode, useContext, useState } from "react";

interface Toast {
  id: string;
  type: "success" | "danger" | "info" | "warning";
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(toast: Toast): void {
    setToasts([toast]);
  }

  function clearToasts(): void {
    setToasts([]);
  }

  return <ToastContext.Provider value={{ toasts, addToast, clearToasts }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export type { Toast };
