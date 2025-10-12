import { queryAllByRole, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthCard } from "../authCard";
import { ToastProvider } from "../../../providers/toastProvider";
import { AbilityContext } from "../../../providers/abilityProvider";
import { DefaultAbility } from "../../../casl/ability";

// Ensure SignUp does not redirect during test render
jest.mock("shared-sdk/lib/api/ApiManager", () => ({
  ApiManager: {
    isLoggedIn: jest.fn(() => false),
    // Debounced validators used by SignUpForm
    checkUserName: jest.fn((cb: (result: boolean) => void) => (/* signup */) => cb(true)),
    checkEmail: jest.fn((cb: (result: boolean) => void) => (/* signup */) => cb(true)),
    // Promise-based validators used on submit
    isValidEmail: jest.fn(async () => true),
    isValidUsername: jest.fn(async () => true),
  },
}));

describe("AuthCard", () => {
  // before(() => {
  //   // Navigate to the URL where your AuthCard component is rendered
  //   cy.visit('/your-app-url');
  // });

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

    // Test title and logo
    const titleElement = getByText("OpenPRA App");
    const logoElement = getByAltText("OpenPRA Logo");

    // Regular expression pattern to match a valid version number (e.g., v0.0.1)
    const versionNumberPattern = /^v\d*\.\d*\.\d*$/;

    // Test description
    const descriptionElement = getByText((content, element) =>
      // Use the regex to check if the content matches the version number pattern
      versionNumberPattern.test(content),
    );

    //grab context
    const authCardContent = getByTestId("Context");

    // Get the list of tab elements within AuthCardContent
    const tabs = queryAllByRole(authCardContent, "tab"); // Assuming the role is 'tab'

    // Assertions
    expect(titleElement).toBeTruthy();
    expect(logoElement).toBeTruthy();
    expect(descriptionElement).toBeTruthy();
    expect(authCardContent).toBeTruthy();
    expect(tabs).toHaveLength(2);

    expect(titleElement.textContent).toBeTruthy();
  });
});
