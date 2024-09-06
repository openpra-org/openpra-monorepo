import { RouterProvider } from "react-router-dom";
import { ReactElement } from "react";
import { ToastProvider } from "./providers/toastProvider";
import { GlobalToastList } from "./components/lists/globalToastList";
import { AbilityContext } from "./providers/ability/AbilityProvider";
import { DefaultAbility } from "./providers/ability/Ability";
import { BrowserRouter } from "./routes/RootRoute";
import { AuthProvider } from "./providers/auth/AuthContext";
import { ThemeProvider } from "./providers/theme/ThemeProvider";

function App(): ReactElement {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AbilityContext.Provider value={DefaultAbility()}>
            <RouterProvider router={BrowserRouter} />
            <GlobalToastList />
          </AbilityContext.Provider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export { App };
