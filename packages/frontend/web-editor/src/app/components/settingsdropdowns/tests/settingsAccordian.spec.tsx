import { render } from "@testing-library/react";
import { AdvancedSettings } from "../advancedSettings";
import "@testing-library/jest-dom";

//Refer to advanced settings for this component to be rendered properly while being passed data.
describe("SettingsAccordian", () => {
  it("should render without errors", () => {
    const { container } = render(<AdvancedSettings />);
    expect(container).toBeInTheDocument();
  });
});
