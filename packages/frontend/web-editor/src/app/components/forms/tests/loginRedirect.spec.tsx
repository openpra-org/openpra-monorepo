import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { LoginForm } from "../loginForm";
import { ToastProvider } from "../../../providers/toastProvider";
import { AbilityContext } from "../../../providers/abilityProvider";
import { DefaultAbility } from "../../../casl/ability";
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div
        data-testid="navigate"
        data-to={to}
      />
    ),
  };
});
jest.mock("shared-sdk/lib/api/ApiManager", () => {
  return {
    ApiManager: {
      signInWithUsernameAndPassword: jest.fn(async () => Promise.resolve()),
      isLoggedIn: jest.fn(() => true),
    },
  };
});
jest.mock("shared-sdk/lib/api/AuthService", () => {
  return {
    AuthService: {
      getRole: jest.fn(() => ({})),
    },
  };
});
jest.mock("../../../casl/ability", () => {
  const actual = jest.requireActual("../../../casl/ability");
  return {
    ...actual,
    UpdateAbility: jest.fn(async () => Promise.resolve()),
  };
});
describe("LoginForm redirect", () => {
  it("navigates to '/' after successful login", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AbilityContext.Provider value={DefaultAbility()}>
          <ToastProvider>
            <LoginForm />
          </ToastProvider>
        </AbilityContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/");
    });
  });
});
