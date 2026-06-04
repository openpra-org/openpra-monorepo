import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RootContainer } from "../../pages/rootContainer";
import { LoginPage } from "../../pages/LandingPage";
import { ToastProvider } from "../../providers/toastProvider";
jest.mock("shared-sdk/lib/api/TypedModelApiManager", () => ({
  GetInternalEvents: jest.fn(async () => []),
  GetInternalHazards: jest.fn(async () => []),
  PostInternalEvent: jest.fn(),
  PatchInternalEvent: jest.fn(),
  DeleteInternalEvent: jest.fn(),
}));
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
    (
      ApiManager as unknown as {
        __setLoggedIn: (v: boolean) => void;
      }
    ).__setLoggedIn(false);
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
    expect(screen.getByText(/Welcome to OpenPRA!/i)).toBeInTheDocument();
    (
      ApiManager as unknown as {
        __setLoggedIn: (v: boolean) => void;
      }
    ).__setLoggedIn(true);
    const { emitAuthEvent } = await import("shared-sdk/lib/api/AuthEvents");
    await act(async () => {
      emitAuthEvent({ type: "login" });
    });
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });
});
