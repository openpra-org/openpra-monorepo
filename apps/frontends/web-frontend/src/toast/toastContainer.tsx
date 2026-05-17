import { useEffect } from "react";
import { useToast } from "./toastProvider";
import "./css/toastContainer.css";

const TYPE_LABELS: Record<string, string> = {
  success: "Success",
  danger: "Error",
  info: "Info",
  warning: "Warning",
};

function ToastContainer(): JSX.Element {
  const { toasts, clearToasts } = useToast();

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => { clearToasts(); }, 4000);
    return () => clearTimeout(id);
  }, [toasts, clearToasts]);

  if (toasts.length === 0) return <></>;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <div className="toast__body">
            <span className="toast__type">{TYPE_LABELS[toast.type]}</span>
            <p className="toast__message">{toast.message}</p>
          </div>
          <button type="button" className="toast__close" onClick={clearToasts}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export { ToastContainer };
