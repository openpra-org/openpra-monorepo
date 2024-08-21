import { RouterProvider } from "react-router-dom";
import { ReactElement } from "react";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./providers/toastProvider";
import { GlobalToastList } from "./components/lists/globalToastList";
import { AbilityContext } from "./providers/ability/AbilityProvider";
import { DefaultAbility } from "./providers/ability/Ability";
import { BrowserRouter } from "./routes/RootRoute";
import { AuthProvider } from "./providers/auth/AuthContext";

function App(): ReactElement {
  const ability = DefaultAbility();
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AbilityContext.Provider value={ability}>
            <RouterProvider router={BrowserRouter} />
            <GlobalToastList />
          </AbilityContext.Provider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export { App };
