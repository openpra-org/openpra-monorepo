import { render } from "@testing-library/react";
import { AdvancedSettings } from "../advancedSettings";
import "@testing-library/jest-dom";
describe("SettingsAccordian", () => {
  it("should render without errors", () => {
    const { container } = render(<AdvancedSettings />);
    expect(container).toBeInTheDocument();
  });
});
