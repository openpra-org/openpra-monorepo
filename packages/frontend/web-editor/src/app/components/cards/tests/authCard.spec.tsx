import { queryAllByRole, render } from "@testing-library/react";
import { AuthCard } from "../../../auth/AuthCard";

describe("AuthCard", () => {
  // before(() => {
  //   // Navigate to the URL where your AuthCard component is rendered
  //   cy.visit('/your-app-url');
  // });

  it("renders AuthCard component with correct elements", () => {
    const { getByText, getByAltText, getByTestId } = render(<AuthCard />);

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
