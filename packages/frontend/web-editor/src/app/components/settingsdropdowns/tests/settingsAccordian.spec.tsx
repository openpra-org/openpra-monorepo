import AdvancedSettings from "../advancedSettings";
import { render } from "@testing-library/react";
import '@testing-library/jest-dom';
import SettingsAccordian from "../SettingsAccordian";

//Refer to advanced settings for this component to be rendered properly while being passed data.
describe(SettingsAccordian, () => {
    it("should render without errors", () => {
        render(<AdvancedSettings />);
    });

})