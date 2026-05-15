import { queryAllByRole, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthCard } from "../authCard";
import { ToastProvider } from "../../../providers/toastProvider";
import { AbilityContext } from "../../../providers/abilityProvider";
import { DefaultAbility } from "../../../casl/ability";
jest.mock("shared-sdk/lib/api/ApiManager", () => {
  return {
    ApiManager: {
      isLoggedIn: jest.fn(function isLoggedInMock(): boolean {
        return false;
      }),
      checkUserName: jest.fn(function checkUserNameMock(cb: (result: boolean) => void) {
        return function debouncedValidator(): void {
          cb(true);
        };
      }),
      checkEmail: jest.fn(function checkEmailMock(cb: (result: boolean) => void) {
        return function debouncedValidator(): void {
          cb(true);
        };
      }),
      isValidEmail: jest.fn(function isValidEmailMock(): Promise<boolean> {
        return Promise.resolve(true);
      }),
      isValidUsername: jest.fn(function isValidUsernameMock(): Promise<boolean> {
        return Promise.resolve(true);
      }),
    },
  };
});
describe("AuthCard", () => {
  it("renders AuthCard component with correct elements", () => {
    const { getByText, getByAltText, getByTestId } = render(
      <MemoryRouter>
        <AbilityContext.Provider value={DefaultAbility()}>
          <ToastProvider>
            <AuthCard />
          </ToastProvider>
        </AbilityContext.Provider>
      </MemoryRouter>,
    );
    const titleElement = getByText("OpenPRA App");
    const logoElement = getByAltText("OpenPRA Logo");
    const versionNumberPattern = /^v\d*\.\d*\.\d*$/;
    const descriptionElement = getByText((content, _element) => versionNumberPattern.test(content));
    const authCardContent = getByTestId("Context");
    const tabs = queryAllByRole(authCardContent, "tab");
    expect(titleElement).toBeTruthy();
    expect(logoElement).toBeTruthy();
    expect(descriptionElement).toBeTruthy();
    expect(authCardContent).toBeTruthy();
    expect(tabs).toHaveLength(2);
    expect(titleElement.textContent).toBeTruthy();
  });
});
