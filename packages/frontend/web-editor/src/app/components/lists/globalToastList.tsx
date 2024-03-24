import { EuiGlobalToastList } from "@elastic/eui";
import { UseToastContext } from "../../providers/toastProvider";

const GlobalToastList: React.FC = () => {
  const { toasts, clearToasts } = UseToastContext();

  return (
    <EuiGlobalToastList
      toasts={toasts}
      dismissToast={clearToasts}
      toastLifeTimeMs={3000}
    />
  );
};

export { GlobalToastList };
