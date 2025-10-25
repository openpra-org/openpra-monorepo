import { act, render, screen } from "@testing-library/react";
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

// Helper to mock ApiManager auth state with a toggle and expose setter
jest.mock("shared-sdk/lib/api/ApiManager", () => {
  let loggedIn = false;
  return {
    __esModule: true,
    ApiManager: {
      isLoggedIn: jest.fn(() => loggedIn),
      getCurrentUser: jest.fn(() => ({ user_id: 1, username: "test" })),
      getTokenTimer: jest.fn(() => 0),
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

describe("Root '/' auth transition without navigation", () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders LoginPage then switches to RecentModelsPage after login", async () => {
    const { ApiManager } = await import("shared-sdk/lib/api/ApiManager");
    // Ensure we start logged out
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

    // Initially shows LoginPage content
    expect(screen.getByText(/Welcome to OpenPRA!/i)).toBeInTheDocument();

    // Flip auth to logged in without changing the route and emit event
    (ApiManager as unknown as { __setLoggedIn: (v: boolean) => void }).__setLoggedIn(true);
    const { emitAuthEvent } = await import("shared-sdk/lib/api/AuthEvents");
    await act(async () => {
      emitAuthEvent({ type: "login" });
    });

    // Now the RecentModelsPage should be visible
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });
});
