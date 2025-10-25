import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RootContainer } from "../../pages/rootContainer";
import { LoginPage } from "../../pages/LandingPage";
import { ToastProvider } from "../../providers/toastProvider";

// Mock TypedModelApiManager to avoid network and return empty lists
jest.mock("shared-sdk/lib/api/TypedModelApiManager", () => ({
  GetInternalEvents: jest.fn(async () => []),
  GetInternalHazards: jest.fn(async () => []),
  PostInternalEvent: jest.fn(),
  PatchInternalEvent: jest.fn(),
  DeleteInternalEvent: jest.fn(),
}));

// Helper to mock ApiManager auth state
jest.mock("shared-sdk/lib/api/ApiManager", () => {
  let loggedIn = false;
  return {
    __esModule: true,
    ApiManager: {
      isLoggedIn: jest.fn(() => loggedIn),
      getCurrentUser: jest.fn(() => ({ user_id: 1, username: "test" })),
      // RootContainer reads a timer id from ApiManager; stub it to a safe number
      getTokenTimer: jest.fn(() => 0),
      // SignUpForm uses these to debounce-validate; return functions that immediately resolve true
      checkUserName: jest.fn((cb: (ok: boolean) => void) => {
        return () => cb(true);
      }),
      checkEmail: jest.fn((cb: (ok: boolean) => void) => {
        return () => cb(true);
      }),
      __setLoggedIn: (v: boolean) => {
        loggedIn = v;
      },
    },
  };
});

describe("Root landing behavior at '/'", () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders RecentModelsPage when logged in", async () => {
    const { ApiManager } = await import("shared-sdk/lib/api/ApiManager");
    (ApiManager as unknown as { __setLoggedIn: (v: boolean) => void }).__setLoggedIn(true);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={<RootContainer />}
            >
              <Route
                index
                element={<LoginPage />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });
  });

  it("renders LoginPage when logged out", async () => {
    const { ApiManager } = await import("shared-sdk/lib/api/ApiManager");
    (ApiManager as unknown as { __setLoggedIn: (v: boolean) => void }).__setLoggedIn(false);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={<RootContainer />}
            >
              <Route
                index
                element={<LoginPage />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome to OpenPRA!/i)).toBeInTheDocument();
    });
  });
});
